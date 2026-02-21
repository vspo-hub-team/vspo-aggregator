module.exports = {
  apps: [{
    name: "vspo-scheduler",
    script: "./scripts/scheduler.ts",  // 要跑的腳本
    interpreter: "node",               // 改用標準的 node 執行
    node_args: "--import tsx",         // 關鍵！告訴 node 要載入 tsx 模組來讀 TypeScript
    cwd: "./",
    autorestart: true,
    watch: false,
    max_memory_restart: "1G"
  }]
};
