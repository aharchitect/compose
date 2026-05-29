function minQueryLen(query) {
  query = query.trim();
  const query_is_float = parseFloat(query);
  const min_query_length = query_is_float ? 1 : 2;
  return min_query_length;
}

function findQuery(query = 'query') {
  const url_params = new URLSearchParams(window.location.search);
  return url_params.has(query) ? url_params.get(query) : empty_string;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(text = empty_string, query = empty_string) {
  if(!query.length) {
    return 0;
  }

  const matches = text.match(new RegExp(escapeRegExp(query), 'gi'));
  return matches ? matches.length : 0;
}

function decodeHtmlEntities(text = empty_string) {
  const decoder = createEl('textarea');
  decoder.innerHTML = text;
  return decoder.value;
}

function getBodyMatch(result) {
  if(!result.matches) {
    return null;
  }

  return result.matches.find(match => match.key === 'body' && match.indices.length);
}

function getSentenceSnippet(text = empty_string, query = empty_string, match = null) {
  const fallback_index = text.toLowerCase().indexOf(query.toLowerCase());
  const match_index = fallback_index > -1 ? fallback_index : match ? match.indices[0][0] : fallback_index;

  if(match_index < 0) {
    return text.substring(0, 220);
  }

  const sentence_start = text.lastIndexOf('.', match_index);
  const question_start = text.lastIndexOf('?', match_index);
  const exclamation_start = text.lastIndexOf('!', match_index);
  const start = Math.max(sentence_start, question_start, exclamation_start);
  const sentence_endings = [
    text.indexOf('.', match_index),
    text.indexOf('?', match_index),
    text.indexOf('!', match_index),
  ].filter(index => index > -1);
  const end = sentence_endings.length ? Math.min.apply(null, sentence_endings) + 1 : match_index + 220;
  const snippet = text.substring(start > -1 ? start + 1 : 0, end).trim();

  return snippet.length > 220 ? `${snippet.substring(0, 217).trim()}...` : snippet;
}

function appendHighlightedText(element, text = empty_string, query = empty_string) {
  if(!query.length) {
    element.textContent = text;
    return;
  }

  const normalized_text = text.toLowerCase();
  const normalized_query = query.toLowerCase();
  let index = 0;
  let match_index = normalized_text.indexOf(normalized_query, index);

  if(match_index < 0) {
    element.textContent = text;
    return;
  }

  while(match_index > -1) {
    if(match_index > index) {
      element.appendChild(document.createTextNode(text.substring(index, match_index)));
    }

    const mark = createEl('mark');
    mark.textContent = text.substring(match_index, match_index + query.length);
    element.appendChild(mark);

    index = match_index + query.length;
    match_index = normalized_text.indexOf(normalized_query, index);
  }

  if(index < text.length) {
    element.appendChild(document.createTextNode(text.substring(index)));
  }
}

function hasSelectedQuickLink() {
  const active_result = elem(`.${search_result_class}.active`);
  return active_result && active_result.closest('.search_results');
}

function prepareFullSearchResults(results = [], query = empty_string) {
  const seen_links = new Set();

  return results
    .map(function(result) {
      result.decoded_body = decodeHtmlEntities(result.body);
      result.occurrence_count = countOccurrences(result.decoded_body, query);
      return result;
    })
    .filter(function(result) {
      if(result.occurrence_count < 1 || seen_links.has(result.link)) {
        return false;
      }

      seen_links.add(result.link);
      return true;
    });
}

function search(index, scope = null, passive = false) {
  scope = search_scope_global ? null : scope;
  if(search_term.length) {
    let raw_results = index;
    if(!algolia_config.on) {
      raw_results = index.search(search_term);
      raw_results = raw_results.map(function(result){
        const score = result.score;
        const result_item = result.item;
        result_item.score = (parseFloat(score) * 50).toFixed(0);
        result_item.matches = result.matches;
        return result_item;
      })
    }

    if(scope) {
      raw_results = raw_results.filter(result_item => {
        return result_item.section == scope;
      });
    }

    passive ? searchResults(raw_results, search_term, true) : searchResults(raw_results, search_term);

  } else {
    passive ? searchResults([], empty_string, true) : searchResults();
  }
}

function liveSearch(index) {
  if (search_field) {
    let search_scope = search_field.dataset.scope;
    search(index, search_scope);
    search_scope = search_scope_global ? null : search_scope;
    if(!search_page_element) {
      search_field.addEventListener('keyup', function(event){
        search_term = search_field.value.trim().toLowerCase();
        if(search_term.length && event.keyCode === 13 && !hasSelectedQuickLink())  {
          const scope_parameter = search_scope ? `&scope=${search_scope}` : empty_string;
          window.location.href = new URL(`search/?query=${search_term}${ scope_parameter }`, root_url).href;
        }
      });
    }
  }
}

function searchResults(results=[], query=empty_string, passive = false) {
  let results_fragment = new DocumentFragment();
  let show_results = elem('.search_results');
  const is_search_page = passive || search_page_element;
  if(is_search_page) {
    show_results = search_page_element;
  }
  emptyEl(show_results);

  const query_len = query.length;
  const required_query_len = minQueryLen(query);

  if(is_search_page && results.length && query_len >= required_query_len) {
    results = prepareFullSearchResults(results, query);
  }

  if(results.length && query_len >= required_query_len) {
    let results_title = createEl(is_search_page ? 'h1' : 'h3');
    results_title.className = 'search_title';
    results_title.innerText = quick_links;

    let go_back_button = createEl('button');
    go_back_button.textContent = 'Go Back';
    go_back_button.className = go_back_class;
    if(passive) {
      results_title.innerText = search_results_label;
    }
    if(!search_page_element) {
      results = results.slice(0,8);
    } else {
      // results_fragment.appendChild(go_back_button);
      results = results.slice(0,12);
    }
    results_fragment.appendChild(results_title);

    results.forEach(function(result){
      let item = createEl('a');
      item.href = `${result.link}?query=${query}`;
      item.className = search_result_class;
      item.style.order = result.score;
      if (is_search_page) {
        pushClass(item, 'passive');
        let item_title = createEl('h3');
        item_title.textContent = result.title;
        item.appendChild(item_title);

        let item_meta = createEl('span');
        const result_body = result.decoded_body || decodeHtmlEntities(result.body);
        const occurrence_count = result.occurrence_count || countOccurrences(result_body, query);
        item_meta.className = 'search_count';
        item_meta.textContent = occurrence_count === 1 ? '1 occurrence' : `${occurrence_count} occurrences`;
        item.appendChild(item_meta);

        let item_description = createEl('p');
        appendHighlightedText(item_description, getSentenceSnippet(result_body, query, getBodyMatch(result)), query);
        item.appendChild(item_description);
      } else {
        item.textContent = result.title;
      }
      results_fragment.appendChild(item);
    });
  }

  if(show_results) {
    let results_title_contents  = empty_string;
    if(query_len >= required_query_len) {
      results_title_contents = !results.length ?
         `<span class='${search_result_class}'>${no_matches_found}</span>` : empty_string;
    } else {
      results_title_contents = `<label for="find" class='${search_result_class}'>${ query_len > 1 ? short_search_query : type_to_search }</label>`
    }

    show_results.innerHTML = results_title_contents;

    show_results.appendChild(results_fragment);
  }
}

function passiveSearch(index) {
  if(search_page_element) {
    search_term = findQuery();
    const search_scope = findQuery('scope');
    search(index, search_scope, true);
  }
}

function hasSearchResults() {
  const results = elem('.results');
  return results ? [results, results.innerHTML.length] : false;
}

function clearSearchResults() {
  let results = hasSearchResults();
  if(results) {
    results = results[0];
    results.innerHTML = empty_string;
    elem(search_field_class).value = empty_string;
  }
}

function onEscape(fn){
  window.addEventListener('keydown', event => event.code === "Escape" ? fn() : false);
}

function initFuseSearch(manual = true) {
  const page_language = document.documentElement.lang;
  const search_index = `${ page_language === 'en' ? empty_string : page_language}/index.json`;
  fetch(new URL(search_index, root_url).href)
  .then(response => response.json())
  .then(function(search_data) {
    search_data = search_data.length ? search_data : [];
    const fuse_index = new Fuse(search_data, search_options);
    manual ? liveSearch(fuse_index) : passiveSearch(fuse_index);
  })
  .catch((error) => console.error(error));
}

function initAlgoliaSearch(manual = true) {
  const algolia_client = algoliasearch(algolia_config.id, algolia_config.key);
  const algolia_index = algolia_client.initIndex(algolia_config.index);
  algolia_index.search(search_term, {
    attributesToRetrieve: search_keys.slice(0,5),
    hitsPerPage: 12,
  }).then(({ hits }) => {
    manual ? liveSearch(hits) : passiveSearch(hits);
  });
}

function tabOverSearchResults() {
  search_field.addEventListener('keydown', function (e) {
    // Prevent curet from moving when up or down is pressed
    if (e.keyCode === 38 || e.keyCode === 40 || e.keyCode === 13) {
      e.preventDefault();
      return;
    }
  });
  search_field.addEventListener('keyup', function (e) {
    if (e.keyCode !== 38 && e.keyCode !== 40 && e.keyCode !== 13) {
      return
    }
    e.preventDefault();

    var results = e.target.parentNode.getElementsByClassName('search_result');
    if (results.length === 0) {
      return;
    }

    // Find the currently selected result and select the next or previous one
    var selected = -1;
    for (var i = 0; i < results.length; i++) {
      if (results[i].classList.contains('active')) {
        selected = i;
        results[i].classList.remove('active');
        break;
      }
    }

    if (e.keyCode === 38) {
      // For up arrow select the previous result
      selected = selected === -1 ? results.length - 1 : selected - 1;
      if (selected < 0) {
        selected = results.length - 1;
      }

      results[selected].classList.add('active');
      return;
    } else if (e.keyCode === 40) {
      // For down arrow select the next result
      selected = selected === -1 ? 0 : selected + 1;
      if (selected === results.length) {
        selected = 0;
      }

      results[selected].classList.add('active');
      return;
    }

    if(selected === -1) {
      return;
    }

    window.location.href = results[selected].href;
    return;
  });
}

function initializeSearch() {
  let main = elem('main');
  main = main ? main : elem('.main');

  search_field.addEventListener('input', function() {
    search_term = search_field.value.trim().toLowerCase();
    algolia_config.on ? initAlgoliaSearch() : initFuseSearch();
  });

  if (search_page_element) {
    algolia_config.on ? initAlgoliaSearch(false) : initFuseSearch(false);
  }

  wrapText(findQuery(), main);

  onEscape(clearSearchResults);

  window.addEventListener('click', function(event){
    const target = event.target;
    const is_search = target.closest(search_class) || target.matches(search_class);
    !is_search && !search_page_element ? clearSearchResults() : false;
  });

  tabOverSearchResults();
}

window.addEventListener('load', () => initializeSearch());
