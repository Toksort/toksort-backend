import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ================= PATH SETUP =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadPath = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// ================= STORAGE =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `data-${Date.now()}.csv`;
    cb(null, uniqueName);
  },
});

// ================= FILE FILTER (FIXED) =================
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  console.log("UPLOAD DEBUG:");
  console.log("Original Name:", file.originalname);
  console.log("MIME:", file.mimetype);
  console.log("EXT:", ext);

  if (ext === ".csv") {
    cb(null, true); // ✅ jangan cek mimetype lagi
  } else {
    cb(new Error("Only CSV files are allowed"), false);
  }
};

// ================= MULTER =================
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export default upload;