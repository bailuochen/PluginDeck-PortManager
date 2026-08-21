const state = {
  ports: [],
  filter: "",
  loading: false
};

const elements = {
  body: document.querySelector("#ports"),
  empty: document.querySelector("#empty"),
  filter: document.querySelector("#filter"),
  notice: document.querySelector("#notice"),
  refresh: document.querySelector("#refresh"),
  summary: document.querySelector("#summary")
};

function setNotice(message = "") {
  elements.notice.textContent = message;
  elements.notice.hidden = !message;
}

function filteredPorts() {
  const query = state.filter.trim().toLowerCase();
  if (!query) return state.ports;
  return state.ports.filter((item) =>
    [item.port, item.pid, item.command, item.address]
      .some((value) => String(value).toLowerCase().includes(query))
  );
}

function cell(text, className = "") {
  const item = document.createElement("td");
  item.textContent = text;
  if (className) item.className = className;
  item.title = String(text);
  return item;
}

function render() {
  const records = filteredPorts();
  elements.body.replaceChildren();
  records.forEach((item) => {
    const row = document.createElement("tr");
    row.append(
      cell(item.port, "port"),
      cell(item.command),
      cell(item.pid, "pid"),
      cell(item.address, "address")
    );
    const action = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "terminate";
    button.textContent = "终止";
    button.disabled = state.loading;
    button.addEventListener("click", () => terminate(item.port));
    action.append(button);
    row.append(action);
    elements.body.append(row);
  });
  elements.empty.hidden = records.length !== 0;

  const portCount = new Set(state.ports.map((item) => item.port)).size;
  elements.summary.textContent = state.loading
    ? "正在读取..."
    : `${portCount} 个监听端口 · ${state.ports.length} 个监听进程`;
}

async function refresh() {
  state.loading = true;
  elements.refresh.disabled = true;
  setNotice();
  render();
  try {
    const result = await window.PluginDeck.invoke("list");
    state.ports = JSON.parse(result.detail || "[]");
  } catch (error) {
    state.ports = [];
    setNotice(error.message || String(error));
  } finally {
    state.loading = false;
    elements.refresh.disabled = false;
    render();
  }
}

async function terminate(port) {
  state.loading = true;
  setNotice();
  render();
  try {
    await window.PluginDeck.invoke("terminate", { port: String(port) });
    await refresh();
  } catch (error) {
    setNotice(error.message || String(error));
    state.loading = false;
    render();
  }
}

elements.filter.addEventListener("input", (event) => {
  state.filter = event.target.value;
  render();
});
elements.refresh.addEventListener("click", refresh);

refresh();
