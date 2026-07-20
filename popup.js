(() => {
  const ShopContext =
    globalThis.ShopCategoryContext ||
    (typeof require === "function" ? require("./shop-context.js") : null);
  const EMPTY_ACTIONS = Object.freeze({
    headers: 0,
    products: 0,
    categories: 0,
    overlays: 0,
  });

  function isSupportedUrl(value) {
    try {
      const url = new URL(value);
      return Boolean(ShopContext?.isCandidateCategoryLocation(url));
    } catch (_error) {
      return false;
    }
  }

  function formatShopTypeLabel(context) {
    if (!context?.supported) {
      return "未确认店铺页面";
    }
    return context.hostType === "custom" ? "自定义店铺域名" : "数字店铺域名";
  }

  function formatPageLabel(value) {
    try {
      const url = new URL(value);
      return `${url.hostname}${url.pathname}`;
    } catch (_error) {
      return "无法读取当前页面";
    }
  }

  function parseRepairActions(value) {
    const result = { ...EMPTY_ACTIONS };
    for (const entry of String(value || "").split(",")) {
      const [key, rawCount] = entry.split(":");
      if (!(key in result)) {
        continue;
      }
      const count = Number.parseInt(rawCount, 10);
      result[key] = Number.isFinite(count) && count >= 0 ? count : 0;
    }
    return result;
  }

  function createStatusModel(status, actionsValue) {
    const actions = parseRepairActions(actionsValue);
    const total = Object.values(actions).reduce((sum, count) => sum + count, 0);

    if (status === "repaired" || total > 0) {
      return {
        state: "success",
        title: "本页已修复",
        detail: `已处理 ${total} 个异常模块。`,
        actions,
      };
    }

    if (status === "active") {
      return {
        state: "success",
        title: "修复已启用",
        detail: "当前页未检测到需要处理的异常模块。",
        actions,
      };
    }

    return {
      state: "warning",
      title: "尚未读取到修复状态",
      detail: "请刷新店铺分类页后再次打开面板。",
      actions,
    };
  }

  const api = {
    createStatusModel,
    formatPageLabel,
    formatShopTypeLabel,
    isSupportedUrl,
    parseRepairActions,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  const pageUrl = document.getElementById("page-url");
  const extensionVersion = document.getElementById("extension-version");
  const statusCard = document.getElementById("status-card");
  const statusTitle = document.getElementById("status-title");
  const statusDetail = document.getElementById("status-detail");
  const runButton = document.getElementById("run-diagnostic");
  const resultSection = document.getElementById("result-section");
  const resultField = document.getElementById("diagnostic-result");
  const copyButton = document.getElementById("copy-result");
  const downloadButton = document.getElementById("download-result");
  const statFields = {
    headers: document.getElementById("stat-headers"),
    products: document.getElementById("stat-products"),
    categories: document.getElementById("stat-categories"),
    overlays: document.getElementById("stat-overlays"),
  };

  let activeTab = null;
  let resultText = "";
  let currentStatusModel = createStatusModel(null, null);

  function renderStatus(model) {
    currentStatusModel = model;
    statusCard.dataset.state = model.state;
    statusTitle.textContent = model.title;
    statusDetail.textContent = model.detail;
    for (const [key, field] of Object.entries(statFields)) {
      field.textContent = String(model.actions?.[key] || 0);
    }
  }

  function renderMessage(title, detail, state = "idle", preserveStats = false) {
    renderStatus({
      title,
      detail,
      state,
      actions: preserveStats ? currentStatusModel.actions : EMPTY_ACTIONS,
    });
  }

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_error) {
      resultField.focus();
      resultField.select();
      return document.execCommand("copy");
    }
  }

  async function readRepairStatus(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["shop-context.js"],
    });
    const executionResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        status: document.documentElement.getAttribute("data-shop-category-repair"),
        actions: document.documentElement.getAttribute(
          "data-shop-category-repair-actions"
        ),
        context: globalThis.ShopCategoryContext?.classifyShopContext?.(
          location,
          document
        ),
      }),
    });
    return executionResults[0]?.result || null;
  }

  async function collectFromPage(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["shop-context.js", "diagnostics-page.js"],
    });

    const executionResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => globalThis.__SHOP_CATEGORY_DIAGNOSTICS__?.collect?.(),
    });

    return executionResults[0]?.result || null;
  }

  async function runDiagnostic() {
    if (!activeTab?.id) {
      renderMessage("无法诊断", "没有找到可诊断的活动标签页。", "error");
      return;
    }

    runButton.disabled = true;
    runButton.textContent = "正在生成…";

    try {
      const result = await collectFromPage(activeTab.id);
      if (!result) {
        throw new Error("页面诊断脚本没有返回结果");
      }

      resultText = JSON.stringify(result, null, 2);
      resultField.value = resultText;
      resultSection.hidden = false;
      const copied = await copyText(resultText);
      renderStatus({
        ...createStatusModel(result.repair?.status, result.repair?.actions),
        title: copied ? "诊断信息已复制" : "诊断已生成",
        detail: copied
          ? "可直接粘贴给维护者。"
          : "自动复制失败，请展开详细诊断手动复制。",
        state: copied ? "success" : "warning",
      });
    } catch (error) {
      const message = String(error?.message || error);
      const restricted = /cannot access|cannot be scripted|chrome:\/\/|edge:\/\//i.test(
        message
      );
      renderMessage(
        "诊断失败",
        restricted ? "当前页面受浏览器限制，无法运行诊断。" : message,
        "error"
      );
    } finally {
      runButton.disabled = false;
      runButton.textContent = "复制诊断信息";
    }
  }

  copyButton.addEventListener("click", async () => {
    const copied = await copyText(resultText);
    renderMessage(
      copied ? "已再次复制" : "复制失败",
      copied ? "诊断 JSON 已写入剪贴板。" : "请在文本框中手动复制。",
      copied ? "success" : "warning",
      true
    );
  });

  downloadButton.addEventListener("click", () => {
    if (!resultText) {
      return;
    }

    const blob = new Blob([resultText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const host = activeTab?.url ? new URL(activeTab.url).hostname : "shop-category";
    anchor.href = url;
    anchor.download = `${host}-diagnostic.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  runButton.addEventListener("click", runDiagnostic);

  extensionVersion.textContent = `v${chrome.runtime.getManifest().version}`;

  getActiveTab()
    .then(async (tab) => {
      activeTab = tab;
      pageUrl.textContent = formatPageLabel(tab?.url || "");
      pageUrl.title = tab?.url || "";

      if (!isSupportedUrl(tab?.url || "")) {
        renderMessage(
          "当前页不受支持",
          "仅适用于数字淘宝/极有家店铺的分类页。",
          "warning"
        );
        runButton.disabled = true;
        return;
      }

      const repairState = await readRepairStatus(tab.id);
      pageUrl.textContent = `${formatPageLabel(tab?.url || "")} · ${formatShopTypeLabel(
        repairState?.context
      )}`;
      if (!repairState?.context?.supported) {
        renderMessage(
          "不符合店铺页特征",
          "该子域名未通过店铺结构检测，不会跳转或修复；可复制诊断信息继续排查。",
          "warning"
        );
        return;
      }
      renderStatus(createStatusModel(repairState?.status, repairState?.actions));
    })
    .catch((error) => {
      renderMessage("无法读取状态", String(error?.message || error), "error");
      runButton.disabled = true;
    });
})();
