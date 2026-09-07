♚⎯⋆⃝📚Shamim Ahamed📚⃝⋆⎯͢⎯♔, [9/7/2026 10:48 PM]
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const app = express();

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN Environment Variable পাওয়া যায়নি।");
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, "uploads");
const dataDir = path.join(__dirname, "data");
const scheduleFile = path.join(dataDir, "schedules.json");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(scheduleFile)) {
  fs.writeFileSync(scheduleFile, "[]");
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

function readSchedules() {
  try {
    return JSON.parse(fs.readFileSync(scheduleFile, "utf8"));
  } catch {
    return [];
  }
}

function saveSchedules(schedules) {
  fs.writeFileSync(
    scheduleFile,
    JSON.stringify(schedules, null, 2)
  );
}

function telegramUrl(method) {
  return https://api.telegram.org/bot${BOT_TOKEN}/${method};
}

async function telegramRequest(method, formData) {
  const response = await fetch(telegramUrl(method), {
    method: "POST",
    body: formData
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.description || "Telegram API Error");
  }

  return result;
}

async function sendText(chatId, text) {
  const form = new FormData();

  form.append("chat_id", String(chatId));
  form.append("text", text);

  return telegramRequest("sendMessage", form);
}

async function sendPhoto(chatId, caption, filePath) {
  const form = new FormData();

  form.append("chat_id", String(chatId));

  if (caption) {
    form.append("caption", caption);
  }

  form.append(
    "photo",
    new Blob([fs.readFileSync(filePath)]),
    path.basename(filePath)
  );

  return telegramRequest("sendPhoto", form);
}

async function sendVideo(chatId, caption, filePath) {
  const form = new FormData();

  form.append("chat_id", String(chatId));

  if (caption) {
    form.append("caption", caption);
  }

  form.append(
    "video",
    new Blob([fs.readFileSync(filePath)]),
    path.basename(filePath)
  );

  return telegramRequest("sendVideo", form);
}

async function sendToGroup(chatId, message, file) {
  if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN সেট করা হয়নি");
  }

  if (!chatId || String(chatId).trim() === "") {
    throw new Error("গ্রুপ আইডি খালি");
  }

  const type = file?.type || "text";

  if (type === "photo") {
    return sendPhoto(chatId, message || "", file.path);
  }

  if (type === "video") {
    return sendVideo(chatId, message || "", file.path);
  }

  return sendText(chatId, message || "");
}

function removeFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function normalizeGroupIds(groupIds) {
  if (Array.isArray(groupIds)) {
    return groupIds
      .map(id => String(id).trim())
      .filter(Boolean);
  }

  if (typeof groupIds === "string") {
    return groupIds
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);
  }

  return [];
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Telegram Broadcast Backend API is running"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    botConfigured: Boolean(BOT_TOKEN)
  });
});

app.post("/api/broadcast", upload.single("file"), async (req, res) => {
  const file = req.file;

  try {
    const message = req.body.message || "";
    const type = req.body.type || "text";
    const groupIds = normalizeGroupIds(req.body.groupIds);

    if (groupIds.length === 0) {
      removeFile(file?.path);

♚⎯⋆⃝📚Shamim Ahamed📚⃝⋆⎯͢⎯♔, [9/7/2026 10:48 PM]
return res.status(400).json({
        success: false,
        message: "কমপক্ষে একটি গ্রুপ আইডি দিতে হবে"
      });
    }

    if (type === "text" && !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "মেসেজ লিখুন"
      });
    }

    if ((type === "photo" || type === "video") && !file) {
      return res.status(400).json({
        success: false,
        message: "Photo অথবা Video ফাইল দিন"
      });
    }

    const results = await Promise.all(
      groupIds.map(async chatId => {
        try {
          await sendToGroup(chatId, message, {
            type,
            path: file?.path
          });

          return {
            groupId: chatId,
            success: true,
            message: "সফলভাবে পাঠানো হয়েছে"
          };
        } catch (error) {
          return {
            groupId: chatId,
            success: false,
            message: error.message
          };
        }
      })
    );

    removeFile(file?.path);

    const successCount = results.filter(item => item.success).length;
    const failedCount = results.length - successCount;

    res.json({
      success: true,
      message: "Broadcast সম্পন্ন হয়েছে",
      total: results.length,
      successCount,
      failedCount,
      results
    });
  } catch (error) {
    removeFile(file?.path);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.post("/api/schedule", upload.single("file"), async (req, res) => {
  const file = req.file;

  try {
    const message = req.body.message || "";
    const type = req.body.type || "text";
    const groupIds = normalizeGroupIds(req.body.groupIds);
    const scheduledAt = req.body.scheduledAt;

    if (groupIds.length === 0) {
      removeFile(file?.path);

      return res.status(400).json({
        success: false,
        message: "কমপক্ষে একটি গ্রুপ আইডি দিতে হবে"
      });
    }

    if (!scheduledAt) {
      removeFile(file?.path);

      return res.status(400).json({
        success: false,
        message: "Schedule Date এবং Time দিন"
      });
    }

    if (new Date(scheduledAt).getTime() <= Date.now()) {
      removeFile(file?.path);

      return res.status(400).json({
        success: false,
        message: "ভবিষ্যতের সময় নির্বাচন করুন"
      });
    }

    const schedules = readSchedules();

    const schedule = {
      id: Date.now().toString(),
      message,
      type,
      groupIds,
      scheduledAt,
      filePath: file?.path || null,
      fileName: file?.originalname || null,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    schedules.push(schedule);
    saveSchedules(schedules);

    res.json({
      success: true,
      message: "মেসেজ Schedule করা হয়েছে",
      schedule: {
        id: schedule.id,
        message: schedule.message,
        type: schedule.type,
        groupIds: schedule.groupIds,
        scheduledAt: schedule.scheduledAt,
        status: schedule.status
      }
    });
  } catch (error) {
    removeFile(file?.path);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.get("/api/schedules", (req, res) => {
  const schedules = readSchedules();

  res.json({
    success: true,
    schedules: schedules.map(item => ({
      id: item.id,
      message: item.message,
      type: item.type,
      groupIds: item.groupIds,
      scheduledAt: item.scheduledAt,
      status: item.status,
      createdAt: item.createdAt
    }))
  });
});

app.delete("/api/schedules/:id", (req, res) => {
  const schedules = readSchedules();
  const id = req.params.id;

  const schedule = schedules.find(item => item.id === id);

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: "Schedule পাওয়া যায়নি"
    });
  }

  removeFile(schedule.filePath);

  const updatedSchedules = schedules.filter(
    item => item.id !== id
  );

  saveSchedules(updatedSchedules);

  res.json({
    success: true,
    message: "Schedule মুছে ফেলা হয়েছে"
  });
});

♚⎯⋆⃝📚Shamim Ahamed📚⃝⋆⎯͢⎯♔, [9/7/2026 10:48 PM]
async function processSchedules() {
  const schedules = readSchedules();
  let changed = false;

  for (const schedule of schedules) {
    if (schedule.status !== "pending") {
      continue;
    }

    const scheduledTime = new Date(schedule.scheduledAt).getTime();

    if (scheduledTime > Date.now()) {
      continue;
    }

    schedule.status = "processing";
    saveSchedules(schedules);

    try {
      const file =
        schedule.filePath && fs.existsSync(schedule.filePath)
          ? {
              type: schedule.type,
              path: schedule.filePath
            }
          : null;

      await Promise.all(
        schedule.groupIds.map(chatId =>
          sendToGroup(chatId, schedule.message, file)
        )
      );

      schedule.status = "sent";
      schedule.sentAt = new Date().toISOString();

      removeFile(schedule.filePath);
    } catch (error) {
      schedule.status = "failed";
      schedule.error = error.message;
    }

    changed = true;
    saveSchedules(schedules);
  }

  if (changed) {
    saveSchedules(schedules);
  }
}

cron.schedule("* * * * *", () => {
  processSchedules().catch(error => {
    console.error("Schedule Error:", error.message);
  });
});

app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});
