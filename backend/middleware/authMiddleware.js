import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (!token) return res.status(401).json({ error: "Missing auth token" });
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "Missing JWT_SECRET on server" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};