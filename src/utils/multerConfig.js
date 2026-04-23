import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// SETUP PATH (ESM SAFE)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadPath = path.join(__dirname, "../uploads");

// ✅ pastikan folder ada
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// GENERATE NAMA FILE
// data-DDMMYY-vX.csv
const generateVersionedFilename = () => {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const shortYear = String(now.getFullYear()).slice(-2);

  const baseName = `data-${day}${month}${shortYear}`;

  const files = fs.readdirSync(uploadPath);

  const matchingFiles = files.filter(f => f.startsWith(baseName));

  let maxVersion = 0;

  matchingFiles.forEach(f => {
    const match = f.match(/v(\d+)/);
    if (match) {
      const version = parseInt(match[1], 10);
      if (version > maxVersion) maxVersion = version;
    }
  });

  const newVersion = maxVersion + 1;

  return `${baseName}-v${newVersion}.csv`;
};

// STORAGE CONFIG
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const filename = generateVersionedFilename();
    cb(null, filename);
  },
});

// FILE FILTER (AMAN)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  // ✅ validasi double (extension + mimetype)
  if (ext === ".csv" && mime.includes("csv")) {
    cb(null, true);
  } else {
    req.fileValidationError = "Only valid CSV files are allowed";
    cb(null, false);
  }
};

// MULTER INSTANCE
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

export default upload;