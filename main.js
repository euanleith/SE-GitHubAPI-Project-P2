//todo json parsing error handling

const MAX_PAGES = 10; //todo

function getNCommitsByAuthor(repo, token, data) {
    console.log('getting n commits by author');
    let url = 'https://api.github.com/repos/' + repo + '/commits';
    forEachPage(url, token, (jsonPage)=>{
        for (let i = 0; i < jsonPage.length; i++) {
            const author = jsonPage[i]['committer']['login'];
            if (!data.has(author)) data.set(author, {commits:1});
            else if (!data.get(author).commits) data.get(author).commits=1;
            else data.get(author).commits++;
        }
    });
    return data;
}

function getNIssuesResolvedByAuthor(repo, token, data) {
    console.log('getting n issues resolved by author');
    let url = 'https://api.github.com/repos/' + repo + '/issues?state=closed';
    forEachPage(url, token, (jsonPage)=>{
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
            if (!data.has(author)) data.set(author, {issues:1});//todo don't want to have commits here
            else if(!data.get(author).issues)  data.get(author).issues=1;
            else data.get(author).issues++;
        }
    });
    return data;
}

function getNPullRequestsReviewedByAuthor(repo, token, data) {
    console.log('getting n pull requests reviewed by author');
    let url = 'https://api.github.com/repos/' + repo + '/pulls?state=closed';
    forEachPage(url, token, (jsonPage)=> {
        let t = data;
        let request = new XMLHttpRequest();
        for (let i = 0; i < jsonPage.length; i++) {
            const num = jsonPage[i]['number'];
            console.log("pinging pull request " + num);
            let url = 'https://api.github.com/repos/' + repo + '/pulls/' + num + '/reviews';//todo might need to do this for each page?
            let jsonReviews = sendHTTPRequest('GET', url, token, null, request);

            jsonReviews.forEach(review => {
                let author = review['user']['login'];
                if (!data.has(author)) data.set(author, {pullRequests:1});//todo
                else if (!data.get(author).pullRequests) data.pullRequests=1;
                else data.get(author).pullRequests++;
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
 * Performs the function f for each page of a GitHub API query
 * The output 'out' is a user-defined data type,
 * which should be instantiated and added to by the user in f.
 * @param url url to query GitHub API
 * @param token GitHub token for query
 * @param f (page,out) function to be performed on data returned from the query
 * @returns user's data
 */
function forEachPage(url, token, f) {
    if (!url.includes("?")) url = url.concat("?per_page=50");
    else url = url.concat("&per_page=50");
    let cont = true;
    const request = new XMLHttpRequest();
    for (let i = 1; cont && i < MAX_PAGES; i++) {
        console.log("pinging page " + i);
        let page = sendHTTPRequest('GET',url,token,null,request);

        f(page);

        let header = request.getResponseHeader("link");
        url = getNextPage(header);
        if (!url) cont = false;
    }
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

function parseHeader(header) {
    let pages = header.split(', ');
    let pageMap = new Map();
    pages.forEach(page=>{
        let pair = page.split("; ");
        let url = pair[0].split('<')[1].split('>')[0];
        let key = pair[1].split('rel="')[1].split('"')[0];
        pageMap.set(key, url);
    });
    return pageMap;
}

function chart() {
    const repo = document.getElementById('repo').value;
    const token = document.getElementById('token').value;
    if (repo === '' || token === '') {
        alert("repo/token not entered")
        return false;
    }

    document.getElementById("loader").style.visibility="visible";

    sleep(100).then(() => //todo remove?
        getData(repo, token).then((data) => {
            console.log("done");

            document.getElementById("loader").style.visibility="hidden";

            display(data);
    }));
}

function sleep (time) {//todo just use setTimeout
    return new Promise((resolve) => setTimeout(resolve, time));
}

//todo name
async function getData(repo, token) {
    let data = new Map();
    data = getNCommitsByAuthor(repo, token, data);
    data = getNIssuesResolvedByAuthor(repo, token, data);
    data = getNPullRequestsReviewedByAuthor(repo, token, data);
    data.forEach((v)=>{
        if (!v.commits) v.commits=0;
        if (!v.issues) v.issues=0;
        if (!v.pullRequests) v.pullRequests=0;
    });
    return data
}

function display(data) {
    const baseWidth = 100;
    const xScale = d3.scaleLinear().domain([0, 20]).range([0, baseWidth]);

    d3.select("#date-column")
        .selectAll("p")
        .data(Array.from(data.keys()))
        .enter()
        .append("p")
        .classed("date-text", true)
        .text(d => d);

    d3.select("#first-bar-column")
        .selectAll("div")
        .data(Array.from(data.keys()))
        .enter()
        .append("div")
        .style("width", d => `${xScale(+data.get(d).commits)}px`)
        .classed("first-bar", true)
        .append("p")
        .classed("label", true)
        .text(d => data.get(d).commits);

    d3.select("#second-bar-column")
        .selectAll("div")
        .data(Array.from(data.keys()))
        .enter()
        .append("div")
        .style("width", d => `${xScale(+data.get(d).issues)}px`)
        .classed("second-bar", true)
        .append("p")
        .classed("label", true)
        .text(d => data.get(d).issues);

    d3.select("#third-bar-column")
        .selectAll("div")
        .data(Array.from(data.keys()))
        .enter()
        .append("div")
        .style("width", d => `${xScale(+data.get(d).pullRequests)}px`)
        .classed("third-bar", true)
        .append("p")
        .classed("label", true)
        .text(d => data.get(d).pullRequests);
}