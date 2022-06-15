navigatum.registerModule(
  "autocomplete",
  (function () {
    function getVisibleElements() {
      const visible = [];

      Object.values(navigatum.app.search.autocomplete.sections).forEach(i=>{
        const s = navigatum.app.search.autocomplete.sections[i];

        Object.values(s.entries).forEach(j=>{
          if (s.n_visible === undefined || j < s.n_visible || s.expanded)
            visible.push(s.entries[j].id);
        });
      });
      return visible;
    }

    function extract_facets(data) {
      const sections = [];
      
      Object.values(data.sections).forEach(i=>{
        const entries = [];

        Object.values(data.sections[i].entries).forEach(j=>{
          // Search uses DC3 and DC1 to mark the beginning/end
          // of a highlighted sequence:
          // https://en.wikipedia.org/wiki/C0_and_C1_control_codes#Modified_C0_control_code_sets
          const e = data.sections[i].entries[j];
          const name = new Option(e.name).innerHTML
            .replaceAll("\x19", "<em>")
            .replaceAll("\x17", "</em>");
          const parsedId = new Option(e.parsed_id).innerHTML
            .replaceAll("\x19", "<em>")
            .replaceAll("\x17", "</em>");
          const subtextBold = new Option(e.subtext_bold).innerHTML
            .replaceAll("\x19", "<em>")
            .replaceAll("\x17", "</em>");
          entries.push({
            id: e.id,
            name: name,
            type: e.type,
            subtext: e.subtext,
            subtext_bold: subtextBold,
            parsed_id: parsedId,
          });
        });

        if (data.sections[i].facet === "sites_buildings") {
          sections.push({
            name: "${{ _.search.sections.buildings }}$",
            expanded: false,
            entries: entries,
            estimatedTotalHits: data.sections[i].estimatedTotalHits,
            n_visible: data.sections[i].n_visible,
          });
        } else if (data.sections[i].facet === "rooms") {
          sections.push({
            name: "${{ _.search.sections.rooms }}$",
            entries: entries,
            estimatedTotalHits: data.sections[i].estimatedTotalHits,
          });
        }
      });

      return sections;
    }

    // As a simple measure against out-of-order responses
    // to the autocompletion, we count queries and make sure
    // that late results will not overwrite the currently
    // visible results.
    let queryCounter = 0;
    let latestUsedQueryId = null;

    return {
      init: function () {},
      oninput: function (q) {
        navigatum.app.search.autocomplete.highlighted = null;

        if (q.length === 0) {
          navigatum.app.search.autocomplete.sections = [];
        } else {
          const queryId = queryCounter;
          queryCounter += 1;

          // no-cache instructs browser, because the cachedFetch will store the reponse.
          const cacheConfig = { cache: "no-cache" };
          cachedFetch
            .fetch(
              `${navigatum.apiBase}search?q=${window.encodeURIComponent(q)}`,
              cacheConfig
            )
            .then((data) => {
              // Data will be cached anyway in case the user hits backspace,
              // but we need to discard the data here if it arrived out of order.
              if (!latestUsedQueryId || queryId > latestUsedQueryId) {
                latestUsedQueryId = queryId;

                navigatum.app.search.autocomplete.sections =
                  extract_facets(data);
              }
            });
        }
      },
      extract_facets: extract_facets,
      onkeydown: function (e) {
        let visible;
        let index;
        switch (e.keyCode) {
          case 27: // ESC
            document.getElementById("search").blur();
            break;

          case 40: // Arrow down
            visible = getVisibleElements();
            index = visible.indexOf(
              navigatum.app.search.autocomplete.highlighted
            );
            if (index === -1 && visible.length > 0) {
              navigatum.app.search.autocomplete.highlighted = visible[0];
            } else if (index >= 0 && index < visible.length - 1) {
              navigatum.app.search.autocomplete.highlighted =
                visible[index + 1];
            }
            e.preventDefault();
            break;

          case 38: // Arrow up
            visible = getVisibleElements();
            index = visible.indexOf(
              navigatum.app.search.autocomplete.highlighted
            );
            if (index === 0) {
              navigatum.app.search.autocomplete.highlighted = null;
            } else if (index > 0) {
              navigatum.app.search.autocomplete.highlighted =
                visible[index - 1];
            }
            e.preventDefault();
            break;

          case 13: // Enter
            if (navigatum.app.search.autocomplete.highlighted !== null) {
              navigatum.app.searchGoTo(
                navigatum.app.search.autocomplete.highlighted,
                true
              );
            } else {
              navigatum.app.searchGo(false);
            }
            break;
        }
      },
    };
  })()
);
