const axios = require('axios');
const path = require('path');
const fs = require('fs');

module.exports = {
 config: {
 name: "gitdel",
 version: "1.1",
 author: "xnil",
 countDown: 5,
 role: 2,
 shortDescription: "Delete file(s) from GitHub",
 longDescription: "Delete selected JavaScript files from GitHub repository",
 category: "utility",
 guide: {
 en: "Use: gitdel\nThen select file numbers to delete from GitHub repo"
 }
 },

 onStart: async function ({ api, message, event }) {
 const adminUID = "61558762813083";
 if (event.senderID !== adminUID)
 return message.reply("❌ You are not authorized to use this command.");

 const folderPath = path.join(__dirname, '..', 'cmds');
 const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
 if (files.length === 0)
 return message.reply("⚠️ No .js files found to delete.");

 const list = files.map((file, index) => `${index + 1}. ${file}`).join("\n");
 const msg = `🗃️ Available Files:\n${list}\n\n🔢 Reply with file numbers (e.g. 1 3 5) to delete from GitHub.`;
 
 return message.reply(msg, (err, info) => {
 global.GoatBot.onReply.set(info.messageID, {
 commandName: "gitdel",
 messageID: info.messageID,
 author: event.senderID,
 files
 });
 });
 },

 onReply: async function ({ api, event, Reply }) {
 if (event.senderID !== Reply.author)
 return api.sendMessage("⛔ You are not the author of this command.", event.threadID);

 const githubToken = "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";
 const owner = "ayanokojisai35-blip";
 const repo = "Nobody-";
 const branch = "main";

 const selected = event.body.split(" ").map(n => parseInt(n)).filter(n => !isNaN(n) && n >= 1 && n <= Reply.files.length);
 if (selected.length === 0)
 return api.sendMessage("⚠️ No valid file numbers selected.", event.threadID);

 const fileNames = selected.map(i => Reply.files[i - 1]);

 try {
 const { data: refData } = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
 headers: { Authorization: `token ${githubToken}` }
 });
 const latestCommitSha = refData.object.sha;

 const { data: commitData } = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, {
 headers: { Authorization: `token ${githubToken}` }
 });
 const baseTreeSha = commitData.tree.sha;

 const { data: treeData } = await axios.post(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
 base_tree: baseTreeSha,
 tree: fileNames.map(name => ({
 path: `scripts/cmds/${name}`,
 mode: '100644',
 type: 'blob',
 sha: null
 }))
 }, {
 headers: { Authorization: `token ${githubToken}` }
 });

 const { data: newCommitData } = await axios.post(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
 message: `Delete ${fileNames.join(', ')}`,
 tree: treeData.sha,
 parents: [latestCommitSha]
 }, {
 headers: { Authorization: `token ${githubToken}` }
 });

 await axios.patch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
 sha: newCommitData.sha
 }, {
 headers: { Authorization: `token ${githubToken}` }
 });

 return api.sendMessage(`✅ Successfully deleted:\n${fileNames.join('\n')}`, event.threadID);
 } catch (err) {
 console.error(err.response?.data || err.message);
 return api.sendMessage("❌ Failed to delete files. Please check logs or GitHub API errors.", event.threadID);
 }
 }
};