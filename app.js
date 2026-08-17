    const state = {
      currentRows: [],
      currentMeta: null,
      tableLimit: 15,
      displayRows: [],
      lastScatterRows: [],
      scatterPanZoom: null,
    };

    const ui = {
      fileInput: document.getElementById("fileInput"),
      pasteInput: document.getElementById("pasteInput"),
      calcMode: document.getElementById("calcMode"),
      diskCountGroup: document.getElementById("diskCountGroup"),
      zfsLevel: document.getElementById("zfsLevel"),
      diskCount: document.getElementById("diskCount"),
      targetUsableGroup: document.getElementById("targetUsableGroup"),
      targetUsableTb: document.getElementById("targetUsableTb"),
      formFactor: document.getElementById("formFactor"),
      classFilter: document.getElementById("classFilter"),
      candidatesOnly: document.getElementById("candidatesOnly"),
      analyzeBtn: document.getElementById("analyzeBtn"),
      downloadBtn: document.getElementById("downloadBtn"),
      buildScriptBtn: document.getElementById("buildScriptBtn"),
      copyScriptBtn: document.getElementById("copyScriptBtn"),
      categoryUrl: document.getElementById("categoryUrl"),
      scriptOutput: document.getElementById("scriptOutput"),
      status: document.getElementById("status"),
      bestOverall: document.getElementById("bestOverall"),
      bestOverallMeta: document.getElementById("bestOverallMeta"),
      bestCandidate: document.getElementById("bestCandidate"),
      bestCandidateMeta: document.getElementById("bestCandidateMeta"),
      modelCount: document.getElementById("modelCount"),
      coverageMeta: document.getElementById("coverageMeta"),
      configView: document.getElementById("configView"),
      configMeta: document.getElementById("configMeta"),
      scatterChart: document.getElementById("scatterChart"),
      barChart: document.getElementById("barChart"),
      summaryList: document.getElementById("summaryList"),
      resultsTable: document.getElementById("resultsTable"),
      showAllBtn: document.getElementById("showAllBtn"),
      openScatterModalBtn: document.getElementById("openScatterModalBtn"),
      chartModal: document.getElementById("chartModal"),
      scatterModalStage: document.getElementById("scatterModalStage"),
      closeScatterModalBtn: document.getElementById("closeScatterModalBtn"),
      resetScatterZoomBtn: document.getElementById("resetScatterZoomBtn"),
      scatterTooltip: document.getElementById("scatterTooltip"),
    };

    function setStatus(message, isError = false) {
      ui.status.textContent = message;
      ui.status.style.color = isError ? "var(--bad)" : "var(--muted)";
    }

    function cleanText(value = "") {
      return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    function parseCapacityTb(text) {
      const tb = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ТБ|TB)/i);
      if (tb) return Number(tb[1].replace(",", "."));
      const gb = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ГБ|GB)/i);
      if (gb) return Number(gb[1].replace(",", ".")) / 1000;
      return null;
    }

    function parseRpm(text) {
      const match = text.match(/(\d{4,5})\s*(?:об\/мин|rpm)/i);
      return match ? Number(match[1]) : null;
    }

    function parseFormFactor(text) {
      const match = text.match(/([23]\.5)\s*["”]/i);
      if (match) return match[1];
      if (/sff/i.test(text)) return "2.5";
      if (/lff/i.test(text)) return "3.5";
      return "";
    }

    function isDnsCatalogListingUrl(url) {
      return url.startsWith("https://www.dns-shop.ru/catalog/") &&
        !url.includes("/catalog/category/") &&
        !url.includes("/catalog/compare/") &&
        !url.includes("category-filters-new") &&
        !url.includes("log-filters") &&
        !url.includes("smart-consult-init") &&
        !url.includes("get-virtual-categories-list");
    }

    function classifyWorkload(row) {
      const text = [row.name, row.title, row.shortSpecs, row.serviceRating].join(" ").toLowerCase();

      if ([
        "exos",
        "ultrastar",
        "wd gold",
        "western digital gold",
        "gold enterprise",
        "wd dc",
        "dc ha340",
        "data center",
        "enterprise",
        " mg0",
        " mg1",
        "mg04",
        "mg09",
        "mg10",
        "mg11",
        "hat5310",
        "hat5320",
      ].some(token => text.includes(token))) {
        return "enterprise";
      }

      if ([
        "ironwolf",
        "red plus",
        "red pro",
        "wd red",
        "nas",
        "n300",
        "hat3300",
        "hat3310",
        "hat3320",
      ].some(token => text.includes(token))) {
        return "nas_or_raid";
      }

      if ([
        "skyhawk",
        "purple",
        "surveillance",
        "pipeline",
        "av-gp",
        "hikvision",
        "s300",
        "dt02-v",
        "dt02-vh",
        "video",
      ].some(token => text.includes(token))) {
        return "surveillance";
      }

      if ([
        "blue",
        "barracuda",
        "wd black",
        " black",
        "p300",
        "x300",
        "dt01",
        "dt02",
        "desktop",
        "pc",
      ].some(token => text.includes(token))) {
        return "desktop";
      }
      return "other";
    }

    function zfsFitNote(row) {
      const notes = [];
      if (row.workloadClass === "nas_or_raid" || row.workloadClass === "enterprise") notes.push("best-fit");
      else if (row.workloadClass === "surveillance") notes.push("acceptable-with-caveats");
      else if (row.workloadClass === "desktop") notes.push("not-ideal");
      else notes.push("needs-manual-check");

      if (row.rpm && row.rpm >= 7200) notes.push("faster");
      if (row.rpm && row.rpm <= 5400) notes.push("cooler/quieter");
      return notes.join(", ");
    }

    function getWorkloadClassLabel(workloadClass) {
      return ({
        nas_or_raid: "NAS / RAID",
        enterprise: "Enterprise / дата-центр",
        surveillance: "Видеонаблюдение",
        desktop: "Обычный настольный",
        other: "Не определено",
      })[workloadClass] || "Не определено";
    }

    function parseProductBlocks(fragment) {
      const blocks = fragment.match(/<div\s+id="p-[^"]+"[\s\S]*?(?=<div\s+id="p-[^"]+"|$)/g) || [];
      return blocks.map(block => {
        const get = (regex) => {
          const match = block.match(regex);
          return match ? cleanText(match[1]) : "";
        };

        const specs = {};
        for (const match of block.matchAll(/catalog-product__spec-label">\s*([^:]+):\s*<\/div><div class="catalog-product__spec-value"[^>]*title="([^"]+)"/gs)) {
          specs[cleanText(match[1])] = cleanText(match[2]);
        }

        const rawNameMatch = block.match(/class="catalog-product__name [^"]+"[^>]*title="([^"]+)"[^>]*>(.*?)<\/a>/s);
        const title = rawNameMatch ? cleanText(rawNameMatch[1]) : "";
        const name = rawNameMatch ? cleanText(rawNameMatch[2]) : "";
        const ratingMatch = block.match(/class="catalog-product__rating"[^>]*><i><\/i><b>([^<]+)<\/b><span>\|<\/span>([^<]+)<\/a>/s);

        return {
          productUuid: get(/data-product="([^"]+)"/),
          productCode: get(/data-code="([^"]+)"/),
          availStatus: get(/data-avail-status="([^"]+)"/),
          productHref: get(/class="catalog-product__name [^"]+" href="([^"]+)"/),
          name,
          title,
          shortSpecs: get(/class="catalog-product__short-specs">\[(.*?)\]<\/span>/s),
          rating: ratingMatch ? cleanText(ratingMatch[1]) : "",
          reviews: ratingMatch ? cleanText(ratingMatch[2]) : "",
          serviceRating: get(/class="catalog-product__service-rating"[^>]*>.*?<\/i>([^<]+)<\/a>/s),
          specCapacity: specs["Объем"] || "",
          specRpm: specs["Скорость вращения"] || "",
          specInterface: specs["Интерфейс"] || "",
        };
      });
    }

    function normalizeRows(productRows, pricesByUuid, store, defaultFormFactor = "") {
      const rows = [];
      for (const [uuid, row] of productRows.entries()) {
        const baseName = row.title || row.name || "";
        const capacityTb = parseCapacityTb(baseName);
        const price = pricesByUuid.get(uuid);
        if (!price || !capacityTb) continue;
        const parts = (row.name || "").split(/\s+/);
        const brand = parts.length > 4 ? parts[4] : "Unknown";
        const rpm = parseRpm([row.title, row.specRpm].join(" "));

        const normalized = {
          ...row,
          store,
          rowKey: `${store}:${uuid}`,
          brand,
          capacityTb,
          priceRub: price,
          rpm,
          formFactor: row.formFactor || parseFormFactor([row.title, row.shortSpecs].join(" ")) || defaultFormFactor,
        };
        normalized.workloadClass = classifyWorkload(normalized);
        normalized.zfsFitNote = zfsFitNote(normalized);
        rows.push(normalized);
      }
      return rows;
    }

    function parseHarPayload(data, fileName = "inline") {
      const entries = data?.log?.entries || [];
      const pricesByUuid = new Map();
      const productRows = new Map();
      const catalogUrls = new Set();
      const countMarkers = [];

      for (const entry of entries) {
        const url = entry?.request?.url || "";
        const mime = entry?.response?.content?.mimeType || "";
        let text = entry?.response?.content?.text || "";

        if (entry?.response?.content?.encoding === "base64") {
          try {
            text = decodeURIComponent(escape(atob(text)));
          } catch {
            text = atob(text);
          }
        }

        if (url.includes("/ajax-state/product-buy/")) {
          try {
            const payload = JSON.parse(text);
            for (const stateItem of payload?.data?.states || []) {
              const uuid = stateItem?.data?.id;
              const price = stateItem?.data?.price?.current;
              if (uuid && price) pricesByUuid.set(uuid, Number(price));
            }
          } catch (error) {
            console.warn("product-buy parse failed", error);
          }
        }

        if (isDnsCatalogListingUrl(url)) {
          catalogUrls.add(url);
          let fragment = text;
          try {
            const payload = JSON.parse(text);
            if (payload && payload.html) fragment = payload.html;
          } catch {}

          const countMatch = fragment.match(/(\d+)\s+товар/i);
          if (countMatch) countMarkers.push(Number(countMatch[1]));

          const productBlocks = parseProductBlocks(fragment);
          if (!productBlocks.length) continue;

          for (const row of productBlocks) {
            if (!row.productUuid) continue;
            productRows.set(row.productUuid, { ...(productRows.get(row.productUuid) || {}), ...row });
          }
        }
      }

      return {
        rows: normalizeRows(productRows, pricesByUuid, "DNS", "3.5"),
        meta: {
          fileName,
          store: "DNS",
          catalogUrlsSeen: catalogUrls.size,
          reportedCategorySize: countMarkers.length ? Math.max(...countMarkers) : null,
        }
      };
    }

    function parseCollectorPayload(data, fileName = "collector.json") {
      const pricesByUuid = new Map();
      const productRows = new Map();
      const countMarkers = [];
      const catalogUrls = new Set();

      for (const page of data?.pages || []) {
        const url = page.url || "";
        const html = page.html || "";
        const buy = page.productBuy || {};
        catalogUrls.add(url);

        const countMatch = html.match(/(\d+)\s+товар/i);
        if (countMatch) countMarkers.push(Number(countMatch[1]));

        for (const row of parseProductBlocks(html)) {
          if (!row.productUuid) continue;
          productRows.set(row.productUuid, { ...(productRows.get(row.productUuid) || {}), ...row });
        }

        for (const stateItem of buy?.data?.states || []) {
          const uuid = stateItem?.data?.id;
          const price = stateItem?.data?.price?.current;
          if (uuid && price) pricesByUuid.set(uuid, Number(price));
        }
      }

      return {
        rows: normalizeRows(productRows, pricesByUuid, "DNS", "3.5"),
        meta: {
          fileName,
          store: "DNS",
          catalogUrlsSeen: catalogUrls.size,
          reportedCategorySize: countMarkers.length ? Math.max(...countMarkers) : null,
        }
      };
    }

    function parseRegardHarPayload(data, fileName = "regard.har") {
      const itemsById = new Map();
      let reportedCategorySize = null;
      let apiCalls = 0;

      for (const entry of data?.log?.entries || []) {
        const url = entry?.request?.url || "";
        if (!url.includes("www.regard.ru/api/site/goods/list")) continue;

        apiCalls += 1;
        let text = entry?.response?.content?.text || "";
        if (entry?.response?.content?.encoding === "base64") {
          try {
            text = decodeURIComponent(escape(atob(text)));
          } catch {
            text = atob(text);
          }
        }

        try {
          const payload = JSON.parse(text);
          if (payload.recordsFiltered) {
            reportedCategorySize = Math.max(reportedCategorySize || 0, Number(payload.recordsFiltered));
          }
          for (const item of payload.data || []) {
            itemsById.set(item.id, item);
          }
        } catch (error) {
          console.warn("regard api parse failed", error);
        }
      }

      const rows = [...itemsById.values()].map(item => {
        const sourceText = [item.full_title, item.title, item.brief].filter(Boolean).join(" ");
        const capacityTb = parseCapacityTb(sourceText);
        const formFactor = parseFormFactor(item.brief || item.title || "");
        const rpm = parseRpm(item.brief || item.postscript || "");
        const row = {
          store: "Regard",
          rowKey: `Regard:${item.id}`,
          productUuid: `regard-${item.id}`,
          productCode: String(item.id),
          availStatus: item.show_flag ? "now" : "unknown",
          productHref: item.seo_url ? `https://www.regard.ru/product/${item.id}/${item.seo_url}` : "",
          name: cleanText(item.title || ""),
          title: cleanText(item.full_title || item.title || ""),
          shortSpecs: cleanText(item.brief || ""),
          rating: item.reviews_stars ? String(item.reviews_stars) : "",
          reviews: item.reviews_count ? String(item.reviews_count) : "",
          serviceRating: "",
          specCapacity: "",
          specRpm: "",
          specInterface: /SATA-?III/i.test(item.brief || "") ? "SATA III" : "",
          brand: cleanText(item.vendor || "Unknown"),
          capacityTb,
          priceRub: Number(item.price || 0),
          rpm,
          formFactor,
        };
        row.workloadClass = classifyWorkload(row);
        row.zfsFitNote = zfsFitNote(row);
        return row;
      }).filter(row => row.priceRub && row.capacityTb);

      return {
        rows,
        meta: {
          fileName,
          store: "Regard",
          catalogUrlsSeen: apiCalls,
          reportedCategorySize,
        }
      };
    }

    function mergeSources(sourceResults) {
      const byUuid = new Map();
      let maxCategorySize = null;
      let catalogUrlsSeen = 0;
      const fileNames = [];
      const storeCoverage = {};

      for (const source of sourceResults) {
        fileNames.push(source.meta.fileName);
        catalogUrlsSeen += source.meta.catalogUrlsSeen || 0;
        if (source.meta.reportedCategorySize) {
          maxCategorySize = Math.max(maxCategorySize || 0, source.meta.reportedCategorySize);
        }
        const store = source.meta.store || "Unknown";
        if (!storeCoverage[store]) {
          storeCoverage[store] = { reportedCategorySize: null, parsedRows: 0 };
        }
        if (source.meta.reportedCategorySize) {
          storeCoverage[store].reportedCategorySize = Math.max(
            storeCoverage[store].reportedCategorySize || 0,
            source.meta.reportedCategorySize
          );
        }
        storeCoverage[store].parsedRows += source.rows.length;

        for (const row of source.rows) {
          byUuid.set(row.rowKey, { ...(byUuid.get(row.rowKey) || {}), ...row });
        }
      }

      const rows = [...byUuid.values()];
      return {
        rows,
        meta: {
          fileNames,
          catalogUrlsSeen,
          reportedCategorySize: maxCategorySize,
          coverageRatio: maxCategorySize ? rows.length / maxCategorySize : null,
          storeCoverage,
        }
      };
    }

    function usableCapacityPerDisk(capacityTb, zfsLevel, diskCount) {
      if (zfsLevel === "stripe") return capacityTb * diskCount;
      if (zfsLevel === "mirror") return capacityTb * Math.floor(diskCount / 2);
      if (zfsLevel === "raidz1") return capacityTb * (diskCount - 1);
      if (zfsLevel === "raidz2") return capacityTb * (diskCount - 2);
      if (zfsLevel === "raidz3") return capacityTb * (diskCount - 3);
      throw new Error(`Unsupported ZFS level: ${zfsLevel}`);
    }

    function validateLayout(zfsLevel, diskCount) {
      const minimums = { stripe: 1, mirror: 2, raidz1: 2, raidz2: 3, raidz3: 4 };
      const minimum = minimums[zfsLevel];
      if (diskCount < minimum) {
        throw new Error(`${zfsLevel} требует минимум ${minimum} дисков.`);
      }
    }

    function requiredDiskCountForTarget(capacityTb, zfsLevel, targetUsableTb) {
      if (zfsLevel === "stripe") {
        return Math.max(1, Math.ceil(targetUsableTb / capacityTb));
      }
      if (zfsLevel === "mirror") {
        return Math.max(2, Math.ceil(targetUsableTb / capacityTb) * 2);
      }
      if (zfsLevel === "raidz1") {
        return Math.max(2, Math.ceil(targetUsableTb / capacityTb) + 1);
      }
      if (zfsLevel === "raidz2") {
        return Math.max(3, Math.ceil(targetUsableTb / capacityTb) + 2);
      }
      if (zfsLevel === "raidz3") {
        return Math.max(4, Math.ceil(targetUsableTb / capacityTb) + 3);
      }
      throw new Error(`Unsupported ZFS level: ${zfsLevel}`);
    }

    function applyZfsMetrics(rows, zfsLevel, diskCount, targetUsableTb = 0) {
      if (!(targetUsableTb > 0)) {
        validateLayout(zfsLevel, diskCount);
      }
      return rows
        .map(row => {
          const effectiveDiskCount = targetUsableTb > 0
            ? requiredDiskCountForTarget(row.capacityTb, zfsLevel, targetUsableTb)
            : diskCount;
          validateLayout(zfsLevel, effectiveDiskCount);
          const usableCapacityTb = usableCapacityPerDisk(row.capacityTb, zfsLevel, effectiveDiskCount);
          if (usableCapacityTb <= 0) return null;
          return {
            ...row,
            zfsLevel,
            diskCount: effectiveDiskCount,
            targetUsableTb: targetUsableTb > 0 ? targetUsableTb : null,
            arrayCostRub: row.priceRub * effectiveDiskCount,
            usableCapacityTb,
            pricePerTbRaw: row.priceRub / row.capacityTb,
            pricePerUsableTb: (row.priceRub * effectiveDiskCount) / usableCapacityTb,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.pricePerUsableTb - b.pricePerUsableTb || a.arrayCostRub - b.arrayCostRub || b.capacityTb - a.capacityTb || a.priceRub - b.priceRub);
    }

    function filterByFormFactor(rows, formFactor) {
      if (formFactor === "all") return rows.slice();
      return rows.filter(row => row.formFactor === formFactor);
    }

    function filterByWorkloadClass(rows, workloadClass) {
      if (workloadClass === "all") return rows.slice();
      return rows.filter(row => row.workloadClass === workloadClass);
    }

    function selectCandidates(rows) {
      return rows
        .filter(row => row.capacityTb >= 4)
        .filter(row => ["nas_or_raid", "enterprise", "surveillance"].includes(row.workloadClass))
        .sort((a, b) => a.pricePerUsableTb - b.pricePerUsableTb || b.capacityTb - a.capacityTb || a.priceRub - b.priceRub);
    }

    function formatRub(value) {
      return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
    }

    function formatRubPerTb(value) {
      return `${Math.round(value).toLocaleString("ru-RU")} ₽ / TB`;
    }

    function updateCalcModeUi() {
      const mode = ui.calcMode.value;
      const byDiskCount = mode === "disk_count";
      ui.diskCount.disabled = !byDiskCount;
      ui.targetUsableTb.disabled = byDiskCount;
      ui.diskCountGroup.classList.toggle("input-disabled", !byDiskCount);
      ui.targetUsableGroup.classList.toggle("input-disabled", byDiskCount);
    }

    function renderCards(rows, candidates, meta, zfsLevel, diskCount, formFactor, targetUsableTb) {
      const best = rows[0];
      const bestCandidate = candidates[0];

      ui.bestOverall.textContent = best ? best.name : "—";
      ui.bestOverallMeta.textContent = best ? `${formatRub(best.priceRub)} за диск, ${formatRubPerTb(best.pricePerUsableTb)} полезного объёма` : "Нет данных";

      ui.bestCandidate.textContent = bestCandidate ? bestCandidate.name : "—";
      ui.bestCandidateMeta.textContent = bestCandidate
        ? `${getWorkloadClassLabel(bestCandidate.workloadClass)}, ${formatRubPerTb(bestCandidate.pricePerUsableTb)}`
        : "Под выбранные фильтры кандидатов не нашлось.";

      ui.modelCount.textContent = String(rows.length);
      const coverageBits = Object.entries(meta.storeCoverage || {}).map(([store, info]) => {
        if (info.reportedCategorySize) {
          return `${store}: ${info.parsedRows}/${info.reportedCategorySize}`;
        }
        return `${store}: ${info.parsedRows}`;
      });
      ui.coverageMeta.textContent = coverageBits.length
        ? `Покрытие по магазинам: ${coverageBits.join(" · ")}.`
        : "Размер категории в HAR не обнаружен, полнота неизвестна.";

      ui.configView.textContent = targetUsableTb > 0 ? `${zfsLevel} до ${targetUsableTb} ТБ` : `${zfsLevel} × ${diskCount}`;
      ui.configMeta.textContent = targetUsableTb > 0
        ? `Количество дисков подбирается автоматически под цель не меньше ${targetUsableTb} ТБ usable, фильтр: ${formFactor}".`
        : zfsLevel === "mirror"
          ? `Для mirror usable-объём считается как набор 2-way mirror пар, фильтр: ${formFactor}".`
          : `Цена считается как стоимость массива / полезный объём, фильтр: ${formFactor}".`;
    }

    function storeColor(store) {
      return ({
        DNS: "#b65d1f",
        Regard: "#2a7a78",
      })[store] || "#6a5acd";
    }

    function getProductUrl(row) {
      if (!row.productHref) return "";
      if (/^https?:\/\//i.test(row.productHref)) return row.productHref;
      if (row.store === "DNS") return `https://www.dns-shop.ru${row.productHref}`;
      return row.productHref;
    }

    function buildScatterSvg(rows, options = {}) {
      const width = options.width || 1500;
      const height = options.height || 760;
      const fontSize = options.fontSize || 19;
      const mutedFontSize = options.mutedFontSize || 17;
      const axisWidth = options.axisWidth || 1.5;
      const margin = options.margin || { top: 42, right: 30, bottom: 88, left: 96 };
      const showPointLabels = options.showPointLabels === true;

      if (!rows.length) {
        return "";
      }

      const plotW = width - margin.left - margin.right;
      const plotH = height - margin.top - margin.bottom;

      const xValues = rows.map(row => row.capacityTb);
      const yValues = rows.map(row => row.pricePerUsableTb);
      const xMin = Math.min(...xValues);
      const xMax = Math.max(...xValues);
      const yMin = Math.min(...yValues);
      const yMax = Math.max(...yValues);

      const sx = value => xMax === xMin ? margin.left + plotW / 2 : margin.left + ((value - xMin) / (xMax - xMin)) * plotW;
      const sy = value => yMax === yMin ? margin.top + plotH / 2 : margin.top + plotH - ((value - yMin) / (yMax - yMin)) * plotH;

      const capacityTicks = [...new Set(rows.map(row => row.capacityTb))].sort((a, b) => a - b);
      let yTickStart = Math.floor(yMin / 1000) * 1000;
      let yTickEnd = Math.ceil(yMax / 1000) * 1000;
      const yTicks = [];
      for (let tick = yTickStart; tick <= yTickEnd; tick += 1000) yTicks.push(tick);

      const points = rows.map(row => `
        <a
          href="${escapeHtml(getProductUrl(row) || "#")}"
          target="_blank"
          rel="noopener noreferrer"
          class="scatter-point-link"
          data-name="${escapeHtml(row.name)}"
          data-store="${escapeHtml(row.store)}"
          data-capacity="${escapeHtml(String(row.capacityTb))}"
          data-price="${escapeHtml(formatRub(row.priceRub))}"
          data-price-per-usable="${escapeHtml(formatRubPerTb(row.pricePerUsableTb))}"
          data-disk-count="${escapeHtml(String(row.diskCount ?? ""))}"
          data-array-cost="${escapeHtml(formatRub(row.arrayCostRub || 0))}"
          data-usable-capacity="${escapeHtml(String(row.usableCapacityTb ?? ""))}"
          data-target-usable="${escapeHtml(String(row.targetUsableTb ?? ""))}"
          data-zfs-level="${escapeHtml(String(row.zfsLevel ?? ""))}"
        >
          <circle class="scatter-point" cx="${sx(row.capacityTb).toFixed(1)}" cy="${sy(row.pricePerUsableTb).toFixed(1)}" r="7" fill="${storeColor(row.store)}"></circle>
        </a>
      `).join("");

      const labels = showPointLabels
        ? rows.slice(0, 7).map(row => `
            <text class="t" x="${sx(row.capacityTb) + 10}" y="${sy(row.pricePerUsableTb) - 10}">${escapeHtml(shortLabel(row.name, 42))}</text>
          `).join("")
        : "";

      return `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <style>
            .t { font-family: Trebuchet MS, Segoe UI, sans-serif; fill: #1f1a17; font-size: ${fontSize}px; }
            .muted { fill: #7b6b5f; font-size: ${mutedFontSize}px; }
            .grid { stroke: #ece1d2; stroke-width: 1; }
            .axis { stroke: #3f3228; stroke-width: ${axisWidth}; }
            .scatter-point { cursor: pointer; transition: r 120ms ease, stroke 120ms ease, opacity 120ms ease; }
            .scatter-point-link:hover .scatter-point { r: 9; stroke: #20160f; stroke-width: 2; }
          </style>
          <rect width="100%" height="100%" fill="transparent"/>
          <line class="axis" x1="${margin.left}" y1="${margin.top + plotH}" x2="${margin.left + plotW}" y2="${margin.top + plotH}"/>
          <line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}"/>
          ${capacityTicks.map(tick => `
            <line class="grid" x1="${sx(tick)}" y1="${margin.top}" x2="${sx(tick)}" y2="${margin.top + plotH}"/>
            <text class="t muted" x="${sx(tick)}" y="${height - 28}" text-anchor="middle">${tick} ТБ</text>
          `).join("")}
          ${yTicks.map(tick => `
            <line class="grid" x1="${margin.left}" y1="${sy(tick)}" x2="${margin.left + plotW}" y2="${sy(tick)}"/>
            <text class="t muted" x="${margin.left - 10}" y="${sy(tick) + 6}" text-anchor="end">${Math.round(tick).toLocaleString("ru-RU")}</text>
          `).join("")}
          ${points}
          ${labels}
          <text class="t" x="${margin.left + plotW / 2}" y="${height - 8}" text-anchor="middle">Ёмкость одного диска</text>
          <text class="t" x="28" y="${margin.top + plotH / 2}" transform="rotate(-90 28 ${margin.top + plotH / 2})" text-anchor="middle">RUB за полезный TB</text>
        </svg>
      `;
    }

    function renderScatter(rows, mountNode) {
      if (!rows.length) {
        mountNode.innerHTML = "<p class='subtle'>Нет точек для графика.</p>";
        return;
      }
      mountNode.innerHTML = buildScatterSvg(rows);
      wireScatterInteractions(mountNode);
    }

    function findScatterLink(target, root) {
      let node = target;
      while (node && node !== root) {
        if (node.classList && node.classList.contains("scatter-point-link")) return node;
        node = node.parentNode;
      }
      return null;
    }

    function showScatterTooltip(link, event) {
      const tooltip = ui.scatterTooltip;
      const diskCount = link.dataset.diskCount || "";
      const arrayCost = link.dataset.arrayCost || "";
      const usableCapacity = link.dataset.usableCapacity || "";
      const targetUsable = link.dataset.targetUsable || "";
      const zfsLevel = link.dataset.zfsLevel || "";
      const purchaseLine = targetUsable
        ? `Для цели ${targetUsable} ТБ usable: ${diskCount} дисков, ${arrayCost}`
        : `Для текущей конфигурации ${zfsLevel}: ${diskCount} дисков, ${arrayCost}`;
      tooltip.innerHTML = `
        <strong>${link.dataset.name || ""}</strong>
        <div>${link.dataset.store || ""} · ${link.dataset.capacity || ""} ТБ</div>
        <div>Цена диска: ${link.dataset.price || ""}</div>
        <div>Цена полезного TB: ${link.dataset.pricePerUsable || ""}</div>
        <div>Полезный объём массива: ${usableCapacity ? `${usableCapacity} ТБ` : "—"}</div>
        <div>${purchaseLine}</div>
      `;
      tooltip.style.display = "block";
      const offset = 18;
      const maxX = window.innerWidth - tooltip.offsetWidth - 12;
      const maxY = window.innerHeight - tooltip.offsetHeight - 12;
      tooltip.style.left = `${Math.max(12, Math.min(event.clientX + offset, maxX))}px`;
      tooltip.style.top = `${Math.max(12, Math.min(event.clientY + offset, maxY))}px`;
    }

    function hideScatterTooltip() {
      ui.scatterTooltip.style.display = "none";
      ui.scatterTooltip.innerHTML = "";
    }

    function wireScatterInteractions(root) {
      root.onmousemove = (event) => {
        const link = findScatterLink(event.target, root);
        if (!link) {
          hideScatterTooltip();
          return;
        }
        showScatterTooltip(link, event);
      };

      root.onmouseleave = () => {
        hideScatterTooltip();
      };
    }

    function renderBars(rows, mountNode) {
      if (!rows.length) {
        mountNode.innerHTML = "<p class='subtle'>Нет моделей для топа.</p>";
        return;
      }

      const topRows = rows.slice(0, 12);
      const width = 1500;
      const barHeight = 34;
      const gap = 20;
      const left = 560;
      const right = 120;
      const top = 30;
      const height = top + topRows.length * (barHeight + gap) + 18;
      const maxValue = Math.max(...topRows.map(row => row.pricePerUsableTb));

      mountNode.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <style>
            .t { font-family: Trebuchet MS, Segoe UI, sans-serif; fill: #1f1a17; font-size: 18px; }
            .muted { fill: #7b6b5f; font-size: 16px; }
          </style>
          ${topRows.map((row, index) => {
            const y = top + index * (barHeight + gap);
            const barWidth = ((width - left - right) * row.pricePerUsableTb) / maxValue;
            return `
              <text class="t" x="12" y="${y + 18}">${escapeHtml(shortLabel(row.name, 64))}</text>
              <text class="t muted" x="12" y="${y + 40}">${row.store} · ${row.capacityTb} ТБ · ${formatRub(row.priceRub)}</text>
              <rect x="${left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${storeColor(row.store)}"/>
              <text class="t" x="${left + barWidth + 10}" y="${y + 22}">${Math.round(row.pricePerUsableTb).toLocaleString("ru-RU")}</text>
            `;
          }).join("")}
        </svg>
      `;
    }

    function enableSvgPanZoom(stage) {
      const svg = stage.querySelector("svg");
      if (!svg) return null;

      const initialViewBox = (svg.getAttribute("viewBox") || "0 0 100 100").split(/\s+/).map(Number);
      const viewBox = {
        x: initialViewBox[0],
        y: initialViewBox[1],
        width: initialViewBox[2],
        height: initialViewBox[3],
      };
      const base = { ...viewBox };
      let drag = null;

      const setViewBox = () => {
        svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
      };

      const clamp = () => {
        const maxX = base.x + base.width - viewBox.width;
        const maxY = base.y + base.height - viewBox.height;
        viewBox.x = Math.max(base.x, Math.min(viewBox.x, maxX));
        viewBox.y = Math.max(base.y, Math.min(viewBox.y, maxY));
      };

      const reset = () => {
        viewBox.x = base.x;
        viewBox.y = base.y;
        viewBox.width = base.width;
        viewBox.height = base.height;
        setViewBox();
      };

      stage.onwheel = (event) => {
        event.preventDefault();
        const rect = stage.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        const zoomFactor = event.deltaY < 0 ? 0.88 : 1.14;
        const nextWidth = Math.max(base.width * 0.18, Math.min(base.width, viewBox.width * zoomFactor));
        const nextHeight = Math.max(base.height * 0.18, Math.min(base.height, viewBox.height * zoomFactor));
        const anchorX = viewBox.x + viewBox.width * px;
        const anchorY = viewBox.y + viewBox.height * py;
        viewBox.x = anchorX - nextWidth * px;
        viewBox.y = anchorY - nextHeight * py;
        viewBox.width = nextWidth;
        viewBox.height = nextHeight;
        clamp();
        setViewBox();
      };

      stage.onpointerdown = (event) => {
        if (findScatterLink(event.target, stage)) {
          return;
        }
        drag = { x: event.clientX, y: event.clientY, boxX: viewBox.x, boxY: viewBox.y };
        stage.classList.add("is-dragging");
        stage.setPointerCapture?.(event.pointerId);
      };

      stage.onpointermove = (event) => {
        if (!drag) return;
        const rect = stage.getBoundingClientRect();
        const dx = ((event.clientX - drag.x) / rect.width) * viewBox.width;
        const dy = ((event.clientY - drag.y) / rect.height) * viewBox.height;
        viewBox.x = drag.boxX - dx;
        viewBox.y = drag.boxY - dy;
        clamp();
        setViewBox();
      };

      const stopDrag = (event) => {
        if (event?.pointerId !== undefined) stage.releasePointerCapture?.(event.pointerId);
        drag = null;
        stage.classList.remove("is-dragging");
      };

      stage.onpointerup = stopDrag;
      stage.onpointercancel = stopDrag;
      stage.onpointerleave = (event) => {
        if (drag) stopDrag(event);
      };

      setViewBox();
      return { reset };
    }

    function openScatterModal() {
      if (!state.lastScatterRows.length) {
        setStatus("Сначала построй анализ, потом можно открыть график на весь экран.", true);
        return;
      }

      ui.scatterModalStage.innerHTML = buildScatterSvg(state.lastScatterRows, {
        width: 2200,
        height: 1400,
        fontSize: 28,
        mutedFontSize: 24,
        axisWidth: 2,
        margin: { top: 60, right: 40, bottom: 120, left: 140 },
      });
      wireScatterInteractions(ui.scatterModalStage);
      state.scatterPanZoom = enableSvgPanZoom(ui.scatterModalStage);
      ui.chartModal.classList.add("is-open");
      ui.chartModal.setAttribute("aria-hidden", "false");
    }

    function closeScatterModal() {
      ui.chartModal.classList.remove("is-open");
      ui.chartModal.setAttribute("aria-hidden", "true");
      ui.scatterModalStage.innerHTML = "";
      state.scatterPanZoom = null;
      hideScatterTooltip();
    }

    function renderSummary(rows, candidates, meta) {
      const items = [];
      const best = rows[0];
      const bestCandidate = candidates[0];
      const capacityGroups = new Map();

      for (const row of rows) {
        const bucket = capacityGroups.get(row.capacityTb) || [];
        bucket.push(row.pricePerUsableTb);
        capacityGroups.set(row.capacityTb, bucket);
      }

      if (best) {
        items.push(`Самый низкий ценник за полезный TB в текущей конфигурации даёт <strong>${escapeHtml(best.name)}</strong>: ${formatRubPerTb(best.pricePerUsableTb)}.`);
      }

      if (bestCandidate) {
        items.push(`Если смотреть на более уместные под ZFS модели, первым идёт <strong>${escapeHtml(bestCandidate.name)}</strong> с классом <code>${escapeHtml(getWorkloadClassLabel(bestCandidate.workloadClass))}</code> и ценой ${formatRubPerTb(bestCandidate.pricePerUsableTb)}.`);
      }

      const capacityLeaders = [...capacityGroups.entries()]
        .map(([capacity, values]) => ({ capacity, median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)] }))
        .sort((a, b) => a.median - b.median);
      if (capacityLeaders[0]) {
        items.push(`По медиане цены за полезный TB лучше всего сейчас выглядит сегмент <strong>${capacityLeaders[0].capacity} ТБ</strong>.`);
      }

      const surveillanceShare = rows.filter(row => row.workloadClass === "surveillance").length;
      if (surveillanceShare) {
        items.push(`В выборке заметная доля surveillance-дисков. Они часто выгодны по цене, но для постоянного ZFS-использования их всё равно стоит проверять внимательнее, чем NAS-линейки.`);
      }

      const storeLeaders = [...new Set(rows.map(row => row.store))].map(store => {
        const bestStoreRow = rows.filter(row => row.store === store)[0];
        return bestStoreRow ? `${store}: ${escapeHtml(bestStoreRow.name)} (${formatRubPerTb(bestStoreRow.pricePerUsableTb)})` : null;
      }).filter(Boolean);
      if (storeLeaders.length) {
        items.push(`Лидеры по магазинам: ${storeLeaders.join("; ")}.`);
      }

      const storeCoverageLines = Object.entries(meta.storeCoverage || {}).map(([store, info]) => {
        if (info.reportedCategorySize) {
          return `${store}: ${info.parsedRows} из ${info.reportedCategorySize}`;
        }
        return `${store}: ${info.parsedRows}`;
      });
      if (storeCoverageLines.length) {
        items.push(`Покрытие по источникам: ${storeCoverageLines.join("; ")}.`);
      } else {
        items.push(`HAR не содержит явного счётчика категории, поэтому оценка полноты основана только на фактически найденных карточках.`);
      }

      ui.summaryList.innerHTML = items.map(item => `<div class="summary-item">${item}</div>`).join("");
    }

    function renderTable(rows) {
      const visibleRows = rows.slice(0, state.tableLimit);
      ui.resultsTable.innerHTML = visibleRows.map(row => `
        <tr>
          <td><span class="tag">${escapeHtml(row.store)}</span></td>
          <td>
            ${getProductUrl(row)
              ? `<a class="product-link" href="${escapeHtml(getProductUrl(row))}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(row.name)}</strong></a>`
              : `<strong>${escapeHtml(row.name)}</strong>`}<br>
            <span class="tag">${escapeHtml(row.zfsFitNote)}</span>
          </td>
          <td>${escapeHtml(row.brand)}</td>
          <td>${row.capacityTb} ТБ</td>
          <td>${formatRub(row.priceRub)}</td>
          <td>${row.usableCapacityTb.toFixed(1)} ТБ</td>
          <td>${formatRubPerTb(row.pricePerUsableTb)}</td>
          <td>${escapeHtml(getWorkloadClassLabel(row.workloadClass))}</td>
        </tr>
      `).join("");
    }

    function shortLabel(text, max = 32) {
      const normalized = text.replace(" Жесткий диск ", " ").trim();
      return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
    }

    function escapeHtml(value) {
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    async function loadFilesAndAnalyze() {
      setStatus("Читаю файлы и собираю модели…");
      const calcMode = ui.calcMode.value;
      const zfsLevel = ui.zfsLevel.value;
      const diskCount = Number(ui.diskCount.value);
      const targetUsableTb = Number(ui.targetUsableTb.value);
      const effectiveTargetUsableTb = calcMode === "target_usable" ? targetUsableTb : 0;
      const formFactor = ui.formFactor.value;
      const classFilter = ui.classFilter.value;

      if (!Number.isFinite(diskCount) || diskCount < 1) {
        throw new Error("Количество дисков должно быть положительным числом.");
      }
      if (!Number.isFinite(targetUsableTb) || targetUsableTb < 0) {
        throw new Error("Необходимый объём должен быть неотрицательным числом.");
      }
      if (calcMode === "target_usable" && !(targetUsableTb > 0)) {
        throw new Error("В режиме подбора по объёму укажи цель больше 0 ТБ.");
      }

      const sourceResults = [];
      const files = [...ui.fileInput.files];
      for (const file of files) {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data?.log?.entries) {
          const urls = (data.log.entries || []).map(entry => entry?.request?.url || "");
          const hasDns = urls.some(url => url.includes("dns-shop.ru"));
          const hasRegard = urls.some(url => url.includes("www.regard.ru"));
          if (hasDns) sourceResults.push(parseHarPayload(data, file.name));
          if (hasRegard) sourceResults.push(parseRegardHarPayload(data, file.name));
          if (!hasDns && !hasRegard) throw new Error(`Не удалось определить магазин для файла ${file.name}.`);
        }
        else if (Array.isArray(data?.pages)) sourceResults.push(parseCollectorPayload(data, file.name));
        else throw new Error(`Файл ${file.name} не похож ни на HAR, ни на live-export JSON.`);
      }

      const pasted = ui.pasteInput.value.trim();
      if (pasted) {
        const data = JSON.parse(pasted);
        if (data?.log?.entries) {
          const urls = (data.log.entries || []).map(entry => entry?.request?.url || "");
          const hasDns = urls.some(url => url.includes("dns-shop.ru"));
          const hasRegard = urls.some(url => url.includes("www.regard.ru"));
          if (hasDns) sourceResults.push(parseHarPayload(data, "pasted-dns-har"));
          if (hasRegard) sourceResults.push(parseRegardHarPayload(data, "pasted-regard-har"));
          if (!hasDns && !hasRegard) throw new Error("Не удалось определить магазин во вставленном HAR.");
        }
        else if (Array.isArray(data?.pages)) sourceResults.push(parseCollectorPayload(data, "pasted-live-export"));
        else throw new Error("Вставленный JSON не похож ни на HAR, ни на live-export JSON.");
      }

      if (!sourceResults.length) {
        throw new Error("Нужно выбрать хотя бы один HAR/JSON файл или вставить JSON вручную.");
      }

      const merged = mergeSources(sourceResults);
      const formScopedRows = filterByFormFactor(merged.rows, formFactor);
      const scopedRows = filterByWorkloadClass(formScopedRows, classFilter);
      if (!scopedRows.length) {
        const formFactorLabel = formFactor === "all" ? "все форм-факторы" : `${formFactor}"`;
        const classLabel = classFilter === "all" ? "все классы" : getWorkloadClassLabel(classFilter);
        throw new Error(`После фильтров (${formFactorLabel}, ${classLabel}) моделей не осталось.`);
      }
      const scored = applyZfsMetrics(scopedRows, zfsLevel, diskCount, effectiveTargetUsableTb);
      const candidates = selectCandidates(scored);
      const chartRows = ui.candidatesOnly.checked && candidates.length ? candidates : scored;

      state.currentRows = scored;
      state.displayRows = chartRows;
      state.currentMeta = merged.meta;
      state.lastScatterRows = scored;
      ui.downloadBtn.disabled = false;

      renderCards(scored, candidates, merged.meta, zfsLevel, diskCount, formFactor, effectiveTargetUsableTb);
      renderScatter(scored, ui.scatterChart);
      renderBars(chartRows, ui.barChart);
      renderSummary(scored, candidates, merged.meta);
      renderTable(chartRows);
      setStatus(`Готово: ${scored.length} моделей, режим: ${calcMode === "target_usable" ? `подбор до ${effectiveTargetUsableTb} ТБ usable` : `${diskCount} дисков`}, магазины: ${[...new Set(scored.map(row => row.store))].join(", ")}, источники: ${merged.meta.fileNames.join(", ")}`);
    }

    function downloadCsv() {
      if (!state.currentRows.length) return;
      const headers = [
        "name","brand","capacity_tb","price_rub","disk_count","target_usable_tb","zfs_level","array_cost_rub",
        "usable_capacity_tb","price_per_tb_raw","price_per_usable_tb","rpm","spec_interface",
        "workload_class","zfs_fit_note","service_rating","avail_status","rating","reviews"
      ];
      const lines = [headers.join(",")];
      for (const row of state.currentRows) {
        const line = [
          row.name, row.brand, row.capacityTb, row.priceRub, row.diskCount, row.targetUsableTb ?? "", row.zfsLevel, row.arrayCostRub,
          row.usableCapacityTb, row.pricePerTbRaw, row.pricePerUsableTb, row.rpm || "", row.specInterface || "",
          row.workloadClass, row.zfsFitNote, row.serviceRating || "", row.availStatus || "", row.rating || "", row.reviews || ""
        ].map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",");
        lines.push(line);
      }
      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = ui.calcMode.value === "target_usable" && ui.targetUsableTb.value && Number(ui.targetUsableTb.value) > 0
        ? `dns-zfs-${ui.zfsLevel.value}-target-${ui.targetUsableTb.value}tb.csv`
        : `dns-zfs-${ui.zfsLevel.value}-${ui.diskCount.value}d.csv`;
      link.click();
    }

    function buildCollectorScript(categoryUrl) {
      return `(async () => {
  const categoryUrl = ${JSON.stringify(categoryUrl)};
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const fetchText = async (url) => {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(\`HTTP \${response.status} for \${url}\`);
    return await response.text();
  };
  const getTotalPages = (html) => {
    const exact = html.match(/страница\\s+\\d+\\s+из\\s+(\\d+)/i);
    if (exact) return Number(exact[1]);
    const pages = [...html.matchAll(/[?&]p=(\\d+)/g)].map(match => Number(match[1]));
    return pages.length ? Math.max(...pages) : 1;
  };
  const extractProductBuyState = (html) => {
    const match = html.match(/"type":"product-buy","hash":"([^"]+)","timeout":\\d+},(\\[.*?\\]),false\\],\\[\\{"type":"avails-container"/s);
    if (!match) throw new Error("Не удалось вытащить product-buy state из HTML.");
    return { hash: match[1], containers: JSON.parse(match[2]) };
  };
  const appendPage = (base, page) => {
    if (page === 1) return base;
    return base.includes("?") ? \`\${base}&p=\${page}\` : \`\${base}?p=\${page}\`;
  };
  const pages = [];
  const firstHtml = await fetchText(categoryUrl);
  const totalPages = getTotalPages(firstHtml);
  for (let page = 1; page <= totalPages; page += 1) {
    const url = appendPage(categoryUrl, page);
    console.log(\`[\${page}/\${totalPages}] \${url}\`);
    const html = page === 1 ? firstHtml : await fetchText(url);
    const productBuyState = extractProductBuyState(html);
    const body = new URLSearchParams();
    body.set("data", JSON.stringify({
      type: "product-buy",
      hash: productBuyState.hash,
      containers: productBuyState.containers.map(item => ({ id: item.id, data: { id: item.data.id } })),
    }));
    const priceResponse = await fetch("/ajax-state/product-buy/", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body,
    });
    if (!priceResponse.ok) throw new Error(\`product-buy failed: \${priceResponse.status}\`);
    const productBuy = await priceResponse.json();
    pages.push({ url, html, productBuy });
    await sleep(250);
  }
  const payload = {
    capturedAt: new Date().toISOString(),
    categoryUrl,
    totalPages,
    pages,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "dns-hdd-live-export.json";
  link.click();
  console.log("Готово. JSON выгружен.");
})();`;
    }

    ui.analyzeBtn.addEventListener("click", async () => {
      try {
        await loadFilesAndAnalyze();
      } catch (error) {
        console.error(error);
        setStatus(error.message || String(error), true);
      }
    });

    ui.downloadBtn.addEventListener("click", downloadCsv);

    ui.showAllBtn.addEventListener("click", () => {
      state.tableLimit = state.tableLimit === 15 ? 30 : 15;
      ui.showAllBtn.textContent = state.tableLimit === 15 ? "Показать 30 строк" : "Показать 15 строк";
      renderTable(state.displayRows || state.currentRows);
    });

    ui.calcMode.addEventListener("change", updateCalcModeUi);
    ui.openScatterModalBtn.addEventListener("click", openScatterModal);
    ui.closeScatterModalBtn.addEventListener("click", closeScatterModal);
    ui.resetScatterZoomBtn.addEventListener("click", () => state.scatterPanZoom?.reset());
    ui.chartModal.addEventListener("click", (event) => {
      if (event.target === ui.chartModal) closeScatterModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && ui.chartModal.classList.contains("is-open")) {
        closeScatterModal();
      }
    });

    ui.buildScriptBtn.addEventListener("click", () => {
      ui.scriptOutput.value = buildCollectorScript(ui.categoryUrl.value.trim());
      setStatus("Live-скрипт сгенерирован. Его можно вставить в DevTools Console на странице DNS.");
    });

    ui.copyScriptBtn.addEventListener("click", async () => {
      if (!ui.scriptOutput.value.trim()) {
        ui.scriptOutput.value = buildCollectorScript(ui.categoryUrl.value.trim());
      }
      await navigator.clipboard.writeText(ui.scriptOutput.value);
      setStatus("Скрипт скопирован в буфер обмена.");
    });

    updateCalcModeUi();
    ui.scriptOutput.value = buildCollectorScript(ui.categoryUrl.value.trim());
  
