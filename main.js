//todo json parsing error handling

//todo replace requests with fetch

const MAX_PAGES = 10; //todo

async function getNCommitsByAuthor(repo, token) {
    console.log('getting n commits by author');
    let data = new Map();
    let url = 'https://api.github.com/repos/' + repo + '/commits';
    let promises = await queryEachPage(url, token);
    promises.forEach(result=>{
        let jsonPage = result.value;
        for (let i = 0; i < jsonPage.length; i++) {
            const author = jsonPage[i]['committer']['login'];
            if (!data.has(author)) data.set(author, 1);
            else data.set(author, data.get(author)+1);
        }
    });
    return data;
}

async function getNIssuesResolvedByAuthor(repo, token) {
    console.log('getting n issues resolved by author');
    let data = new Map();
    let url = 'https://api.github.com/repos/' + repo + '/issues?state=closed';
    let promises = await queryEachPage(url, token);
    promises.forEach(result=>{
        let jsonPage = result.value;
        let request = new XMLHttpRequest();
        for (let i = 0; i < jsonPage.length; i++) {
            const num = jsonPage[i]['number'];
            console.log("pinging issue " + num);
            let url = 'https://api.github.com/repos/' + repo + '/issues/' + num + '/events';//todo might need to do this for each page?
            let jsonEvent = sendHTTPRequest('GET',url, token,null,request);

            const closedEvent = jsonEvent.find(e=>e['event']==="closed");
            const actor = closedEvent['actor'];
            let author;
            if (actor === null) author = "null";
            else author = actor['login'];
            if (!data.has(author)) data.set(author, 1);
            else data.set(author, data.get(author)+1);
        }
    });
    return data;
}

async function getNPullRequestsReviewedByAuthor(repo, token) {
    console.log('getting n pull requests reviewed by author');
    let data = new Map();
    let url = 'https://api.github.com/repos/' + repo + '/pulls?state=closed';
    let promises = await queryEachPage(url, token);
    promises.forEach(result=>{
        let jsonPage = result.value;
        let request = new XMLHttpRequest();
        for (let i = 0; i < jsonPage.length; i++) {
            const num = jsonPage[i]['number'];
            console.log("pinging pull request " + num);
            let url = 'https://api.github.com/repos/' + repo + '/pulls/' + num + '/reviews';//todo might need to do this for each page?
            let jsonReviews = sendHTTPRequest('GET', url, token, null, request);

            jsonReviews.forEach(review => {
                let author = review['user']['login'];
                if (!data.has(author)) data.set(author, 1);
                else data.set(author, data.get(author)+1);
            });
        }
    });
    return data;
}

function sendHTTPRequest(type, url, token, body=undefined, request=undefined) {
    if (request === undefined) request = new XMLHttpRequest();
    request.open(type, url, false);
    request.setRequestHeader('Authorization', 'token ' + token);
    request.send(body);
    //todo exception handling
    return JSON.parse(request.responseText);
}

/**
 * Returns the results for each page of a GitHub API query
 * @param url url to query GitHub API
 * @param token GitHub token for query
 * @return {Promise} array of query promises to be acted on
 */
async function queryEachPage(url, token) {
    if (!url.includes("?")) url = url.concat("?per_page=50");
    else url = url.concat("&per_page=50");
    const request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.setRequestHeader('Authorization', 'token ' + token);
    request.send();
    let header = request.getResponseHeader("link");
    const nPages = getNPages(header);
    let promises = [];//todo linked list or something?

    let i = 1;
    for (; i <= nPages; i++) {
        console.log("pinging page " + i);

        let pageUrl = url + "&page=" + i;
        promises.push(fetch(pageUrl, {
            method: 'GET',
            headers: {
                Authorization: 'token ' + token
            }
        }).then(result=>result.json()));
    }
    return Promise.allSettled(promises);
}

/**
 * Parses the header to get the url of the next page if it exists
 * @param header header of current page
 * @returns {string|null} url of next page if it exists, otherwise null
 */
function getNextPage(header) {
    if (header) {
        if (!header.includes('rel="next"')) return null;
        const map = parseHeader(header);
        return map.get('next');
    }
    return null;
}

function getNPages(header) {
    if (header) {
        if (!header.includes('rel="last"')) return null;
        const map = parseHeader(header);
        const url = map.get('last')
        return parseInt(url.split('&page=')[1]);
    }
    return 1;
}

//todo name parseLinkHeader
function parseHeader(header) {
    try {
        if (!header) return null;
        let pages = header.split(', ');
        let pageMap = new Map();
        for (let page of pages) {
            let pair = page.split("; ");
            if (pair.length === 1) return null;
            let url = pair[0].split('<')[1].split('>')[0];
            let key = pair[1].split('rel="')[1].split('"')[0];
            pageMap.set(key, url);
        }
        return pageMap;
    } catch (e) {return null}
}

module.exports.parseHeader = parseHeader;//todo

function chart() {
    const repo = document.getElementById('repo').value;
    const token = document.getElementById('token').value;
    if (repo === '' || token === '') {
        alert("repo/token not entered")
        return false;
    }

    document.getElementById("loader").style.visibility="visible";

    setTimeout(()=>
        getData(repo, token, (data)=>{
                console.log("done");
                document.getElementById("loader").style.visibility = "hidden";
                display(data);
        }),
        100);
}

function getData(repo, token, callback) {
    let promises = [];
    promises.push(getNCommitsByAuthor(repo, token));
    promises.push(getNIssuesResolvedByAuthor(repo, token));
    promises.push(getNPullRequestsReviewedByAuthor(repo, token));

    Promise.allSettled(promises).then(results=>{
        let maps = [];
        results.forEach(promise=>maps.push(promise.value));
        // get list of unique keys (authors)
        let authors = {};
        for (let map of maps) {
            for (let author of map.keys()) {
                if (!authors[author]) authors[author] = true;
            }
        }

        // then for each add data
        let data = new Map();
        for (let author in authors) {
            let d = {};
            if (maps[0].has(author)) d.commits = maps[0].get(author);
            else d.commits = 0;
            if (maps[1].has(author)) d.issues = maps[1].get(author);
            else d.issues = 0;
            if (maps[1].has(author)) d.pullRequests = maps[1].get(author);
            else d.pullRequests = 0;
            data.set(author, d);
        }

        callback(data);//todo make promise instead?
    });
}

function avg(author) {
    return author.commits + author.issues + author.pullRequests / 3;
}

function max(values) {
    let max = -1;
    for (let v of values) {
        max = Math.max(max,v.commits);
        max = Math.max(max,v.issues);
        max = Math.max(max,v.pullRequests);
    }
    return max;
}

//todo ' (' + (data.get(d).type/avg(data.get(d))*100).toFixed()+'%)'
function display(data) {
    //data = new Map();
    //data.set("SheetJSDev",{commits:54,issues:12,pullRequests:0});
    //data.set("obj7",{commits:0,issues:1,pullRequests:0});

    const dataTypes = ['Author','No. commits','No. issues resolved',' No. pull requests reviewed']
    const maxInput = max(data.values());
    const authors = Array.from(data.keys());

    const width = 190;
    const height = 20;
    const margin = 5;
    const xScale = d3.scaleLinear()
        .domain([0, maxInput])
        .range([0, width-margin]);

    d3.select("#data-type-column")
        .selectAll("p")
        .data(dataTypes)
        .enter()
        .append("p")
        .style("width", () => `${width-(2*margin)}px`)
        .style("margin", () => `${margin}px`)
        .style("height", () => `${height}px`)
        .classed("data-type-text", true)
        .text(d => d);

    d3.select("#author-column")
        .selectAll("p")
        .data(authors)
        .enter()
        .append("p")
        .style("width", () => `${width-(2*margin)}px`)
        .style("margin", () => `${margin}px`)
        .style("height", () => `${height}px`)
        .classed("author-text", true)
        .text(d => d);

    d3.select("#commit-bar-column")
        .style("width", () => `${width}px`)
        .selectAll("div")
        .data(authors)
        .enter()
        .append("div")
        .style("width", () => `${width-margin}px`)
        .style("margin", () => `${margin}px`)
        .classed("background",true)
        .append("div")
        .style("width", d => `${xScale(data.get(d).commits)}px`)
        .classed("commit-bar", true)
        .append("p")
        .style("margin-left", () => `${margin}px`)
        .text(d => data.get(d).commits)
        .classed("label", true);

    d3.select("#issue-bar-column")
        .style("width", () => `${width}px`)
        .selectAll("div")
        .data(authors)
        .enter()
        .append("div")
        .style("width", () => `${width-margin}px`)
        .style("margin", () => `${margin}px`)
        .classed("background",true)
        .append("div")
        .style("width", d => `${xScale(data.get(d).issues)}px`)
        .classed("issue-bar", true)
        .append("p")
        .style("margin-left", () => `${margin}px`)
        .text(d => data.get(d).issues)
        .classed("label", true);

    d3.select("#pull-request-bar-column")
        .style("width", () => `${width}px`)
        .selectAll("div")
        .data(authors)
        .enter()
        .append("div")
        .style("width", () => `${width-margin}px`)
        .style("margin", () => `${margin}px`)
        .classed("background",true)
        .append("div")
        .style("width", d => `${xScale(data.get(d).pullRequests)}px`)
        .classed("pull-request-bar", true)
        .append("p")
        .style("margin-left", () => `${margin}px`)
        .text(d => data.get(d).pullRequests)
        .classed("label", true);
}