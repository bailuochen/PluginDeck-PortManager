ObjC.import("Foundation");

function readStandardInput() {
  const data = $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
  return ObjC.unwrap(
    $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding)
  );
}

function runTask(executable, arguments) {
  const task = $.NSTask.alloc.init;
  const standardOutput = $.NSPipe.pipe;
  const standardError = $.NSPipe.pipe;
  task.launchPath = executable;
  task.arguments = arguments;
  task.standardOutput = standardOutput;
  task.standardError = standardError;
  task.launch;
  task.waitUntilExit;

  const outputData = standardOutput.fileHandleForReading.readDataToEndOfFile;
  const errorData = standardError.fileHandleForReading.readDataToEndOfFile;
  return {
    status: Number(task.terminationStatus),
    stdout: ObjC.unwrap(
      $.NSString.alloc.initWithDataEncoding(outputData, $.NSUTF8StringEncoding)
    ),
    stderr: ObjC.unwrap(
      $.NSString.alloc.initWithDataEncoding(errorData, $.NSUTF8StringEncoding)
    )
  };
}

function listListeningPorts() {
  const result = runTask("/usr/sbin/lsof", [
    "-nP",
    "-a",
    "-iTCP",
    "-sTCP:LISTEN",
    "-Fpcn"
  ]);
  if (result.status !== 0 && result.stdout.trim() === "") {
    return [];
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "lsof failed");
  }

  let currentPID = "";
  let currentCommand = "";
  const seen = new Set();
  const records = [];
  result.stdout.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("p")) {
      currentPID = line.slice(1);
    } else if (line.startsWith("c")) {
      currentCommand = line.slice(1);
    } else if (line.startsWith("n")) {
      const endpoint = line.slice(1);
      const match = endpoint.match(/:(\d+)$/);
      if (!match || !currentPID) return;
      const port = Number(match[1]);
      const key = `${currentPID}:${port}:${endpoint}`;
      if (seen.has(key)) return;
      seen.add(key);
      records.push({
        port,
        pid: Number(currentPID),
        command: currentCommand || "Unknown",
        address: endpoint
      });
    }
  });
  return records.sort((left, right) =>
    left.port - right.port || left.command.localeCompare(right.command)
  );
}

function terminatePort(rawPort) {
  const value = String(rawPort || "").trim();
  if (!/^\d+$/.test(value)) {
    throw new Error("端口必须是 1 到 65535 之间的整数");
  }
  const port = Number(value);
  if (port < 1 || port > 65535) {
    throw new Error("端口必须是 1 到 65535 之间的整数");
  }

  const lookup = runTask("/usr/sbin/lsof", [
    "-nP",
    "-a",
    `-iTCP:${port}`,
    "-sTCP:LISTEN",
    "-t"
  ]);
  const processIDs = Array.from(new Set(
    lookup.stdout.split(/\s+/).filter((pid) => /^\d+$/.test(pid))
  ));
  if (processIDs.length === 0) {
    throw new Error(`端口 ${port} 当前没有监听进程`);
  }

  const failures = [];
  const terminated = [];
  processIDs.forEach((pid) => {
    const result = runTask("/bin/kill", ["-TERM", pid]);
    if (result.status === 0) {
      terminated.push(pid);
    } else {
      failures.push(`${pid}: ${result.stderr.trim() || "permission denied"}`);
    }
  });
  if (failures.length > 0) {
    throw new Error(`部分进程无法终止：${failures.join("; ")}`);
  }
  return { port, processIDs: terminated };
}

function success(id, title, message, detail) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    result: { title, message, detail }
  });
}

function failure(id, message) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code: -32000, message }
  });
}

function run() {
  let request = null;
  try {
    request = JSON.parse(readStandardInput().trim());
    if (request.method === "ports.list") {
      const ports = listListeningPorts();
      const count = new Set(ports.map((item) => item.port)).size;
      return success(
        request.id,
        "监听端口",
        `发现 ${count} 个监听端口`,
        JSON.stringify(ports)
      );
    }
    if (request.method === "ports.terminate") {
      const payload = request.params && request.params.payload || {};
      const result = terminatePort(payload.port);
      return success(
        request.id,
        "端口已终止",
        `端口 ${result.port} 的监听进程已收到终止信号`,
        `PID: ${result.processIDs.join(", ")}`
      );
    }
    return failure(request.id, "Method not found");
  } catch (error) {
    return failure(request && request.id || null, String(error.message || error));
  }
}
