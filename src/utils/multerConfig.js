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

// ================= CONFIG =================

const ALLOWED_EXTENSIONS = [".csv"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const sanitizeFileName = (filename) => {
  return filename
    .toString()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
};

const generateFileName = (originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  const baseName = path.basename(originalname, ext);
  const safeBaseName = sanitizeFileName(baseName) || "upload";
  const timestamp = Date.now();

  return `${safeBaseName}-${timestamp}${ext}`;
};

// ================= STORAGE =================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const filename = generateFileName(file.originalname);
    cb(null, filename);
  },
});

// ================= FILE FILTER =================

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error("File harus berformat CSV"), false);
  }

  return cb(null, true);
};

// ================= MULTER =================

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

export default upload;