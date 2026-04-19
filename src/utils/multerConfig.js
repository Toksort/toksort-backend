import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// 🔥 biar bisa pakai __dirname di ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ pastikan folder uploads ada
const uploadPath = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// 🔥 storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath); // ✅ pakai absolute path
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

// 🔥 filter hanya CSV
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === ".csv") {
    cb(null, true);
  } else {
    req.fileValidationError = "Only CSV files are allowed";
    cb(null, false);
  }
};

const upload = multer({ storage, fileFilter });

export default upload;

// Generate nama file otomatis: data-DDMMYY-vX.csv
function generateVersionedFilename() {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const shortYear = String(now.getFullYear()).slice(-2);

  const baseName = `data-${day}${month}${shortYear}`;

  // Cari versi yang sudah ada
  const files = fs.readdirSync(uploadPath);

  // Filter semua file yang match date sekarang
  const matchingFiles = files.filter(f => f.startsWith(baseName));

  // Cari version number tertinggi
  let maxVersion = 0;
  matchingFiles.forEach(f => {
    const match = f.match(/v(\d+)/);
    if (match) {
      const version = parseInt(match[1], 10);
      if (version > maxVersion) maxVersion = version;
    }
  });

  // Version baru
  const newVersion = maxVersion + 1;

  return `${baseName}-v${newVersion}.csv`;
}
