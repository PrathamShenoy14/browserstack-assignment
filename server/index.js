const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const LOG_FILE = path.join(__dirname, "myLog.txt");
let previousSize = 0;

// Read last N lines from end of file (efficient, line-aware)
function readLastNLines(filePath, maxLines = 10, encoding = 'utf8') {
  return new Promise((resolve, reject) => {
    fs.open(filePath, 'r', (err, fd) => {
      if (err) return reject(err);

      fs.fstat(fd, (err, stats) => {
        if (err) return reject(err);

        const fileSize = stats.size;
        const bufferSize = 1024;
        const buffer = Buffer.alloc(bufferSize);
        let position = fileSize;
        let lines = [];
        let leftover = '';

        const readChunk = () => {
          if (position <= 0 || lines.length >= maxLines + 5) {
            const fullText = leftover + lines.join('\n');
                let allLines = fullText.split('\n');

                // ✅ Check if the original text ended with a newline
                if (fileSize > 0 && fullText.endsWith('\n')) {
                allLines.push('');
                }
            return resolve(allLines.slice(-maxLines));
          }

          position = Math.max(0, position - bufferSize);
          const length = Math.min(bufferSize, fileSize - position);

          fs.read(fd, buffer, 0, length, position, (err, bytesRead) => {
            if (err) return reject(err);

            const chunk = buffer.toString(encoding, 0, bytesRead);
            const combined = chunk + leftover;
            const split = combined.split('\n');
            leftover = split.shift();
            lines = split.concat(lines);

            readChunk();
          });
        };

        readChunk();
      });
    });
  });
}

// Initialize previousSize from the file
fs.stat(LOG_FILE, (err, stats) => {
  if (!err) previousSize = stats.size;
});

io.on("connection", (socket) => {
  console.log("Client connected");

  readLastNLines(LOG_FILE, 10)
    .then(lines => socket.emit("init", lines))
    .catch(console.error);
});

// Track if a read is ongoing to avoid duplicate triggers
let isReading = false;
let changePending = false;

fs.watch(LOG_FILE, (eventType) => {
  if (eventType !== "change") return;
  if (isReading) {
    changePending = true;
    return;
  }

  handleFileChange();
});

function handleFileChange() {
  isReading = true;

  fs.stat(LOG_FILE, (err, stats) => {
    if (err || stats.size < previousSize) {
      previousSize = stats?.size || 0;
      isReading = false;
      return;
    }

    const newSize = stats.size;
    const diffSize = newSize - previousSize;

    if (diffSize <= 0) {
      isReading = false;
      return;
    }

    const buffer = Buffer.alloc(diffSize);
    fs.open(LOG_FILE, 'r', (err, fd) => {
      if (err) {
        isReading = false;
        return;
      }

      fs.read(fd, buffer, 0, diffSize, previousSize, (err, bytesRead) => {
        fs.close(fd, () => {});
        isReading = false;

        if (err || bytesRead <= 0) return;

        const newData = buffer.toString("utf8", 0, bytesRead);
        const newLines = newData.split('\n');

        if (newLines.length > 0) {
          io.emit("update", newLines); // Send exactly what was appended
        }

        previousSize = newSize;

        if (changePending) {
          changePending = false;
          handleFileChange(); // process any missed event
        }
      });
    });
  });
}

server.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
});
