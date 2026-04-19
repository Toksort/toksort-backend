const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Pastikan folder uploads ada
const uploadPath = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

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

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const finalName = generateVersionedFilename();
    cb(null, finalName);
  }
});

// Filter hanya CSV
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/octet-stream',
  ];

  const isCsv =
    allowedTypes.includes(file.mimetype) ||
    file.originalname.endsWith('.csv');

  if (isCsv) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type, only CSV allowed!'), false);
  }
};
