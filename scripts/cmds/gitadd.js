const axios = require('axios');
const path = require('path');

module.exports = {
 config: {
 name: "gitadd",
 version: "1.1",
 author: "xnil",
 countDown: 5,
 role: 2,
 shortDescription: "Add a file to GitHub repo",
 longDescription: "Easily add a JavaScript file to your GitHub repository using code or a URL.",
 category: "utility",
 guide: {
 en: "Usage:\ngitadd <file name>.js <code | code url>"
 }
 },

 onStart: async function ({ api, message, args, event }) {
 const fileName = args[0];
 const codeSource = args.slice(1).join(" ");

 if (!fileName || !codeSource) {
 return message.reply({
 body: `⚠️ Missing Arguments!\nPlease use: gitadd <file name>.js <code or URL>`
 });
 }

 if (!fileName.endsWith('.js')) {
 return message.reply({
 body: `❌ Invalid File Name!\nOnly *.js files are allowed.`
 });
 }

 const githubToken = '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';
 const owner = 'ayanokojisai35-blip';
 const repo = 'Yoo';
 const branch = 'main';
 const filePath = path.join('scripts', 'cmds', fileName);

 try {
 const code = codeSource.startsWith('http')
 ? (await axios.get(codeSource)).data
 : codeSource;

 const { data: refData } = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
 headers: { Authorization: `token ${githubToken}` }
 });
 const latestCommitSha = refData.object.sha;

 const { data: commitData } = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, {
 headers: { Authorization: `token ${githubToken}` }
 });
 const baseTreeSha = commitData.tree.sha;

 const { data: blobData } = await axios.post(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
 content: code,
 encoding: 'utf-8'
 }, {
 headers: { Authorization: `token ${githubToken}` }
 });

 const { data: treeData } = await axios.post(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
 base_tree: baseTreeSha,
 tree: [{
 path: filePath,
 mode: '100644',
 type: 'blob',
 sha: blobData.sha
 }]
 }, {
 headers: { Authorization: `token ${githubToken}` }
 });

 const { data: newCommitData } = await axios.post(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
 message: `Add ${fileName}`,
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

 message.reply({
 body: `✅ Successfully added file!\n\n📂 File: ${fileName}\n📁 Path: scripts/cmds/${fileName}\n🟢 Status: Committed to GitHub`
 });

 } catch (err) {
 const errorMsg = err.response?.data?.message || err.message;
 message.reply({
 body: `❌ Failed to add file!\nError: ${errorMsg}`
 });
 }
 }
};
