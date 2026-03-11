import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("agrozoo.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT -- 'admin' or 'seller'
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    cost_per_unit REAL,
    min_price REAL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT,
    distance REAL,
    term_months INTEGER,
    observations TEXT,
    total_requested REAL,
    min_required REAL,
    status TEXT, -- 'pending', 'approved', 'rejected'
    seller_id INTEGER,
    nf_number TEXT,
    correction_status TEXT, -- 'requested', 'corrected'
    corrected_commission REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(seller_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity REAL,
    requested_price REAL,
    min_price_at_time REAL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );
`);

// Seed initial users if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("admin", "admin123", "admin");
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("vendedor", "venda123", "seller");
}

// Seed initial products if empty
const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (productCount.count === 0) {
  const initialProducts = [
    { name: "FACCA - 2,4D + PICLORAM - 20 LT", cost: 14.00 },
    { name: "DECORUM - 2,4D 806 SL - 20 LT", cost: 13.60 },
    { name: "TRICLOMAX TRICLOPIR 480 EC - 20 LT", cost: 36.60 },
    { name: "CCAB - PICLORAM 240 SL - 20 LT", cost: 27.03 },
    { name: "WIDCLEAR - FLUORIXIPIR - 20 LT", cost: 36.60 },
    { name: "AMINOPIRALIDE + 2,4D - 20 LT", cost: 25.00 },
    { name: "METSULFUEON ULTRA - 200 G", cost: 185.00 },
    { name: "XENON - FLOROXIPIR + PICLORAM - 20 LT", cost: 38.00 },
    { name: "IPA - GLIFOSATO - 1 LT", cost: 19.43 },
    { name: "POCCO - GLIFOSATO 480 SL - 5 LT", cost: 23.10 },
    { name: "ROUNDUP - GLIFOSATO 720 WG - 5 KG", cost: 26.92 },
    { name: "ATRAER - ATRAZINA - 10 KG", cost: 27.73 },
    { name: "MESOFORCE - MESOTRIONA 480SC - 5 LTS", cost: 50.00 },
    { name: "SOYACLEAN XTRA - IMAZETAPIR - 5 KG", cost: 132.00 },
    { name: "TOP FIX", cost: 12.00 },
    { name: "TOP ULTRA", cost: 27.50 },
    { name: "DROP", cost: 37.00 },
    { name: "BIO TOP", cost: 75.00 },
    { name: "BIFENTRINA", cost: 37.00 },
    { name: "BRA30", cost: 9.50 },
    { name: "TOP AMINO", cost: 14.58 },
    { name: "KINGPRIDO", cost: 70.00 },
    { name: "LASTING", cost: 40.00 },
    { name: "POWER DRONE", cost: 60.00 },
    { name: "20-00-20", cost: 2.35 },
    { name: "05-25-15", cost: 2.80 }
  ];

  const insertProduct = db.prepare("INSERT INTO products (name, cost_per_unit, min_price) VALUES (?, ?, ?)");
  initialProducts.forEach(p => {
    const minPrice = p.cost * 1.20;
    insertProduct.run(p.name, p.cost, minPrice);
  });
}

// Update existing products to 20% margin if requested (one-time update logic)
db.prepare("UPDATE products SET min_price = cost_per_unit * 1.20").run();

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT id, username, role FROM users WHERE username = ? AND password = ?").get(username, password) as any;
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Usuário ou senha inválidos" });
    }
  });

  // Products API
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products").all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { name, cost_per_unit, min_price } = req.body;
    const result = db.prepare("INSERT INTO products (name, cost_per_unit, min_price) VALUES (?, ?, ?)").run(name, cost_per_unit, min_price);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/products/:id", (req, res) => {
    const { id } = req.params;
    const { name, cost_per_unit, min_price } = req.body;
    db.prepare("UPDATE products SET name = ?, cost_per_unit = ?, min_price = ? WHERE id = ?").run(name, cost_per_unit, min_price, id);
    res.json({ success: true });
  });

  // Orders API
  app.get("/api/orders", (req, res) => {
    const { seller_id, role } = req.query;
    
    let query = `
      SELECT o.*, u.username as seller_name 
      FROM orders o 
      JOIN users u ON o.seller_id = u.id
    `;
    const params: any[] = [];

    if (role === "seller" && seller_id) {
      query += " WHERE o.seller_id = ?";
      params.push(seller_id);
    }

    query += " ORDER BY o.created_at DESC";

    const orders = db.prepare(query).all(...params) as any[];

    // Fetch items for each order
    orders.forEach(order => {
      order.items = db.prepare(`
        SELECT oi.*, p.name as product_name 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = ?
      `).all(order.id);
    });

    res.json(orders);
  });

  app.get("/api/orders/:id/items", (req, res) => {
    const items = db.prepare(`
      SELECT oi.*, p.name as product_name 
      FROM order_items oi 
      JOIN products p ON oi.product_id = p.id 
      WHERE oi.order_id = ?
    `).all(req.params.id);
    res.json(items);
  });

  app.post("/api/orders", (req, res) => {
    const { client_name, distance, term_months, observations, items, seller_id } = req.body;

    let totalRequested = 0;
    let totalMinBase = 0;

    // Calculate totals
    items.forEach((item: any) => {
      const product = db.prepare("SELECT min_price FROM products WHERE id = ?").get(item.product_id) as any;
      const minPrice = product ? product.min_price : 0;
      totalRequested += item.quantity * item.requested_price;
      totalMinBase += item.quantity * minPrice;
      item.min_price_at_time = minPrice;
    });

    // Apply Term Adjustment (1.5% per month)
    const termAdjustedMin = totalMinBase * (1 + 0.015 * term_months);
    
    // Apply Distance Adjustment (distance * 14)
    const distanceAdjustment = distance * 14;
    
    // Final Minimum for Approval
    const minRequired = termAdjustedMin + distanceAdjustment;

    // Auto Approval Logic
    let status = "pending";
    if (totalRequested >= minRequired) {
      status = "approved";
    }

    const insertOrder = db.prepare(`
      INSERT INTO orders (client_name, distance, term_months, observations, total_requested, min_required, status, seller_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insertOrder.run(client_name, distance, term_months, observations, totalRequested, minRequired, status, seller_id);
    const orderId = result.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity, requested_price, min_price_at_time)
      VALUES (?, ?, ?, ?, ?)
    `);

    items.forEach((item: any) => {
      insertItem.run(orderId, item.product_id, item.quantity, item.requested_price, item.min_price_at_time);
    });

    res.json({ id: orderId, status });
  });

  app.patch("/api/orders/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
  });

  app.post("/api/orders/:id/request-correction", (req, res) => {
    const { id } = req.params;
    const { nf_number } = req.body;
    db.prepare("UPDATE orders SET nf_number = ?, correction_status = 'requested' WHERE id = ?").run(nf_number, id);
    res.json({ success: true });
  });

  app.post("/api/orders/:id/submit-correction", (req, res) => {
    const { id } = req.params;
    const { corrected_commission } = req.body;
    db.prepare("UPDATE orders SET corrected_commission = ?, correction_status = 'corrected' WHERE id = ?").run(corrected_commission, id);
    res.json({ success: true });
  });

  // Users API
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT id, username, role FROM users").all();
    res.json(users);
  });

  app.post("/api/users", (req, res) => {
    const { username, password, role } = req.body;
    try {
      const result = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, password, role);
      res.json({ id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: "Nome de usuário já existe" });
    }
  });

  app.put("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const { username, password, role } = req.body;
    if (password) {
      db.prepare("UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?").run(username, password, role, id);
    } else {
      db.prepare("UPDATE users SET username = ?, role = ? WHERE id = ?").run(username, role, id);
    }
    res.json({ success: true });
  });

  app.delete("/api/users/:id", (req, res) => {
    const { id } = req.params;
    // Prevent deleting the last admin if possible, but for now just allow deletion
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
