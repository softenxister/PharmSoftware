// tsx asks Node for a POSIX user ID when it creates its temporary directory.
// Windows does not provide process.geteuid(), so tsx falls back to
// os.userInfo(). That lookup fails on this machine with uv_os_get_passwd.
// Providing a stable Windows-only ID avoids the broken lookup.
if (process.platform === "win32" && typeof process.geteuid !== "function") {
  Object.defineProperty(process, "geteuid", {
    configurable: true,
    value: () => 0,
  });
}

async function start() {
  await import("tsx/esm");
  await import("./index.ts");
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
