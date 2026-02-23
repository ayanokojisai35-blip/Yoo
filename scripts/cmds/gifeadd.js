const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');

const owner = "ayanokojisai35-blip";
const repo = "Yoo";
const branch = "main";
const githubToken = "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";

const validExtensions = [".mp4", ".mp3", ".gif", ".webp", ".png", ".jpg", ".jpeg"];

module.exports = {
  config: {
    name: "gifeadd",
    aliases: ["setgife"],
    version: "4.1",
    author: "Rafi + Rex",
    countDown: 5,
    role: 2,
    shortDescription: "Upload/send/delete media to folder",
    longDescription: "Upload and manage files in scripts/cmds/<folder>/<filename>",
    category: "utility",
    guide: {
      en: `
Reply to a media with:
- gifeadd <folder> <filename> → to upload
- gifeadd list <folder> → see files
- gifeadd send <folder> → show list
- gifeadd send <folder> <number> → send file
- gifeadd delete <folder> <number> → delete file
`.trim()
    }
  },

  onStart: async function ({ message, event, args }) {
    const { messageReply } = event;
    const baseFolder = path.join("scripts", "cmds");

    // List
    if (args[0] === "list") {
      const folder = args[1];
      if (!folder) return message.reply("⚠️ Folder name missing.");
      const folderPath = path.join(baseFolder, folder);
      if (!fs.existsSync(folderPath)) return message.reply("❌ Folder not found.");
      const files = fs.readdirSync(folderPath).filter(f => validExtensions.includes(path.extname(f)));
      if (!files.length) return message.reply("❌ No media found.");
      return message.reply(`📁 Files in '${folder}':\n` + files.map((f, i) => `${i + 1}. ${f}`).join("\n"));
    }

    // Send
    if (args[0] === "send") {
      const folder = args[1];
      if (!folder) return message.reply("⚠️ Folder name missing.");
      const folderPath = path.join(baseFolder, folder);
      if (!fs.existsSync(folderPath)) return message.reply("❌ Folder not found.");
      const files = fs.readdirSync(folderPath).filter(f => validExtensions.includes(path.extname(f)));
      if (!files.length) return message.reply("❌ No media found.");

      if (!args[2]) {
        return message.reply(`📁 Files in '${folder}':\n` +
          files.map((f, i) => `${i + 1}. ${f}`).join("\n") +
          `\n\nReply with: gifeadd send ${folder} <number>`);
      }

      const index = parseInt(args[2]) - 1;
      if (isNaN(index) || !files[index]) return message.reply("❌ Invalid number.");
      const filePath = path.join(folderPath, files[index]);
      return message.reply({ attachment: fs.createReadStream(filePath) });
    }

    // Delete (updated)
    if (args[0] === "delete") {
      const folder = args[1];
      const number = parseInt(args[2]) - 1;
      if (!folder || isNaN(number)) return message.reply("⚠️ Usage: gifeadd delete <folder> <number>");
      const folderPath = path.join(baseFolder, folder);
      if (!fs.existsSync(folderPath)) return message.reply("❌ Folder not found.");
      const files = fs.readdirSync(folderPath).filter(f => validExtensions.includes(path.extname(f)));
      if (!files[number]) return message.reply("❌ Invalid number.");
      const fileName = files[number];
      const localFile = path.join(folderPath, fileName);
      const githubPath = `scripts/cmds/${folder}/${fileName}`;
      const githubApi = `https://api.github.com/repos/${owner}/${repo}/contents/${githubPath}`;

      try {
        const { data: fileInfo } = await axios.get(githubApi, {
          headers: {
            Authorization: `token ${githubToken}`
          }
        });

        await axios.delete(githubApi, {
          headers: {
            Authorization: `token ${githubToken}`
          },
          data: {
            message: `Delete ${fileName}`,
            sha: fileInfo.sha,
            branch
          }
        });

        fs.unlinkSync(localFile);
        return message.reply(`🗑️ Permanently deleted from GitHub and local:\n${fileName}`);
      } catch (err) {
        console.error(err);
        return message.reply(`❌ Failed to delete:\n${err.response?.data?.message || err.message}`);
      }
    }

    // Upload
    if (!messageReply || !messageReply.attachments || messageReply.attachments.length === 0) {
      return message.reply("⚠️ Reply to a media file to upload.");
    }

    if (args.length < 2) {
      return message.reply("⚠️ Usage: gifeadd <folder> <filename>");
    }

    const attachment = messageReply.attachments[0];
    const folderName = args[0];
    const safeFileName = args[1].replace(/[^a-zA-Z0-9-_]/g, "_");

    let ext = mime.extension(attachment.contentType || '') || "";

    // fallback from URL
    if (!ext) {
      if (attachment.url.includes(".mp4")) ext = "mp4";
      else if (attachment.url.includes(".gif")) ext = "gif";
      else if (attachment.url.includes(".webp")) ext = "webp";
      else if (attachment.url.includes(".jpg") || attachment.url.includes(".jpeg")) ext = "jpg";
      else if (attachment.url.includes(".png")) ext = "png";
      else if (attachment.url.includes(".m4a") || attachment.url.includes(".ogg")) ext = "mp3";
      else if (attachment.url.includes(".mp3")) ext = "mp3";
      else return message.reply("❌ Unsupported file type.");
    }

    // Convert only voice to mp3
    if (["m4a", "ogg"].includes(ext)) {
      ext = "mp3";
    }

    ext = "." + ext.toLowerCase();
    if (!validExtensions.includes(ext)) return message.reply(`❌ Unsupported file type: ${ext}`);

    const fileName = safeFileName + ext;
    const localFolder = path.join(baseFolder, folderName);
    const localPath = path.join(localFolder, fileName);
    const githubPath = `scripts/cmds/${folderName}/${fileName}`;
    const githubApi = `https://api.github.com/repos/${owner}/${repo}/contents/${githubPath}`;

    try {
      fs.ensureDirSync(localFolder);
      const res = await axios.get(attachment.url, { responseType: 'stream' });
      const writer = fs.createWriteStream(localPath);
      res.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      const fileContent = fs.readFileSync(localPath, { encoding: "base64" });

      await axios.put(githubApi, {
        message: `Add ${fileName}`,
        content: fileContent,
        branch
      }, {
        headers: {
          Authorization: `token ${githubToken}`,
          "Content-Type": "application/json"
        }
      });

      return message.reply(`✅ Uploaded successfully!\n📁 ${folderName}/${fileName}`);
    } catch (err) {
      console.error(err);
      return message.reply(`❌ Upload failed:\n${err.response?.data?.message || err.message}`);
    }
  }
};
