//todo json parsing error handling

const MAX_PAGES = 10; //todo

async function getNCommitsByAuthor(repo, token, data) {
    console.log('getting n commits by author');
    let url = 'https://api.github.com/repos/' + repo + '/commits';
    let promises = await queryEachPage(url, token);
    for (const promise of promises) {
        let text = promise.value;
        for (let i = 0; i < text.length; i++) {
            const author = text[i]['committer']['login'];
            if (!data.has(author)) data.set(author, {commits:1});
            else if (!data.get(author).commits) data.get(author).commits=1;
            else data.get(author).commits++;
        }
    }
    return data;
}

async function getNIssuesResolvedByAuthor(repo, token, data) {
    console.log('getting n issues resolved by author');
    let url = 'https://api.github.com/repos/' + repo + '/issues?state=closed';
    let promises = await queryEachPage(url, token);
    let promisesPages = [];
    for (const promise of promises) {
        let text = promise.value;
        for (let i = 0; i < text.length; i++) {
            const num = text[i]['number'];
            console.log("pinging issue events " + num);
            let url = 'https://api.github.com/repos/' + repo + '/issues/' + num + '/events';
            promisesPages.push(queryEachPage(url, token));
        }
    }
    await Promise.allSettled(promisesPages).then(promiseEventsPages=>{
        for (const promisesEventsPage of promiseEventsPages) {
            const promiseEvents = promisesEventsPage.value;
            for (const promiseEvent of promiseEvents) {
                let events = promiseEvent.value;
                const closedEvent = events.find(e => e['event'] === "closed");//todo case where can't find it
                const actor = closedEvent['actor'];
                let author;
                if (actor === null) author = "null";
                else author = actor['login'];
                if (!data.has(author)) data.set(author, {issues: 1});
                else if (!data.get(author).issues) data.get(author).issues = 1;
                else data.get(author).issues++;
            }
        }
    });
    return data;
}

async function getNPullRequestsReviewedByAuthor(repo, token, data) {
    console.log('getting n pull requests reviewed by author');
    let url = 'https://api.github.com/repos/' + repo + '/pulls?state=closed';
    let promises = await queryEachPage(url, token);
    let promisesPages = [];
    for (const promise of promises) {
        let text = promise.value;
        for (let i = 0; i < text.length; i++) {
            const num = text[i]['number'];
            console.log("pinging pull request reviews " + num);
            let url = 'https://api.github.com/repos/' + repo + '/pulls/' + num + '/reviews';
            promisesPages.push(queryEachPage(url, token));
        }
    }
    await Promise.allSettled(promisesPages).then(promiseReviewsPages=>{
        for (const promiseReviewPage of promiseReviewsPages) {
            const promiseReviews = promiseReviewPage.value;
            for (const promiseReview of promiseReviews) {
                const reviews = promiseReview.value;
                for (const review of reviews) {
                    let author = review['user']['login'];
                    if (!data.has(author)) data.set(author, {pullRequests: 1});
                    else if (!data.get(author).pullRequests) data.pullRequests = 1;
                    else data.get(author).pullRequests++;
                }
            }
        }
    });
    return data;
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

    let header = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: 'token ' + token
        }
    }).then(result=>result.headers.get('link'));
    const nPages = getNPages(header);

    let promises = [];
    let i;
    for (i = 1; i <= nPages; i++) {
        console.log("pinging page " + i);
        let pageUrl = url + "&page=" + i;
        promises.push(fetch(pageUrl, {
            method: 'GET',
            headers: {
                Authorization: 'token ' + token
            }
        }).then(result=>{
            console.log('got response');//todo
            return result.json()
        }));
    }
    return Promise.allSettled(promises);
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
        getData(repo, token).then((data)=>{
                console.log("done");
                document.getElementById("loader").style.visibility = "hidden";
                const clusters = clusterData(data);
                display(clusters);
        }),
        100);
}

async function getData(repo, token) {
    let data = new Map();
    data = await getNCommitsByAuthor(repo, token, data);
    data = await getNIssuesResolvedByAuthor(repo, token, data);
    data = await getNPullRequestsReviewedByAuthor(repo, token, data);
    data.forEach((v)=>{
        if (!v.commits) v.commits=0;
        if (!v.issues) v.issues=0;
        if (!v.pullRequests) v.pullRequests=0;
    });
    //todo order; also then can cluster more efficiently maybe
    return data;
}

function clusterData(data) {
    let bin1 = 3, bin2 = 10; //todo make variable?
    let clusters = [new Map(), new Map(), new Map()];
    data.forEach((v,k)=>{
        const sum = v.commits + v.issues + v.pullRequests;
        if (sum < bin1) clusters[2].set(k,v);
        else if (sum < bin2) clusters[1].set(k,v);
        else clusters[0].set(k,v);
    });
    return clusters;
}

function avg(author) {
    return author.commits + author.issues + author.pullRequests / 3;
}

function max(data) {
    let max = 0;
    if (data) {
        for (const map of data) {
            const values = map.values();
            for (let v of values) {
                max = Math.max(max, v.commits);
                max = Math.max(max, v.issues);
                max = Math.max(max, v.pullRequests);
            }
        }
    }
    return max;
}

//todo ' (' + (data.get(d).type/avg(data.get(d))*100).toFixed()+'%)'
function display(data) {
    //data = new Map();
    //data.set("SheetJSDev",{commits:54,issues:12,pullRequests:0});
    //data.set("obj7",{commits:0,issues:1,pullRequests:0});

    const dataTypes = ['','Author','No. commits','No. issues resolved',' No. pull requests reviewed']
    const maxInput = max(data);

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
        .style("width", () => `${width - (2 * margin)}px`)
        .style("margin", () => `${margin}px`)
        .style("height", () => `${height}px`)
        .classed("data-type-text", true)
        .text(d => d);

    const titles = ['Cluster 1','Cluster 2','Cluster 3'];


    for (let i = 0; i < data.length; i++) {

        const authors = Array.from(data[i].keys());

        if (authors.length === 0) continue;

        d3.select('body')
            .append('p');

        const rows = d3.select('body')
            .append('div')
            .classed('row',true);

        rows.append('p')
            .text(() => titles[i])
            .style("width", () => `${width}px`)

        //todo put these in a function
        rows.append("div")
            .selectAll("p")
            .data(authors)
            .enter()
            .append("p")
            .style("width", () => `${width - (2 * margin)}px`)
            .style("margin", () => `${margin}px`)
            .style("height", () => `${height}px`)
            .classed("author-text", true)
            .text(d => d);

        rows.append("div")
            .style("width", () => `${width}px`)
            .selectAll("div")
            .data(authors)
            .enter()
            .append("div")
            .style("width", () => `${width - margin}px`)
            .style("margin", () => `${margin}px`)
            .classed("background", true)
            .append("div")
            .style("width", d => `${xScale(data[i].get(d).commits)}px`)
            .classed("commit-bar", true)
            .append("p")
            .style("margin-left", () => `${margin}px`)
            .text(d => data[i].get(d).commits)
            .classed("label", true);

        rows.append("div")
            .style("width", () => `${width}px`)
            .selectAll("div")
            .data(authors)
            .enter()
            .append("div")
            .style("width", () => `${width - margin}px`)
            .style("margin", () => `${margin}px`)
            .classed("background", true)
            .append("div")
            .style("width", d => `${xScale(data[i].get(d).issues)}px`)
            .classed("issue-bar", true)
            .append("p")
            .style("margin-left", () => `${margin}px`)
            .text(d => data[i].get(d).issues)
            .classed("label", true);

        rows.append('div')
            .style("width", () => `${width}px`)
            .selectAll("div")
            .data(authors)
            .enter()
            .append("div")
            .style("width", () => `${width - margin}px`)
            .style("margin", () => `${margin}px`)
            .classed("background", true)
            .append("div")
            .style("width", d => `${xScale(data[i].get(d).pullRequests)}px`)
            .classed("pull-request-bar", true)
            .append("p")
            .style("margin-left", () => `${margin}px`)
            .text(d => data[i].get(d).pullRequests)
            .classed("label", true);
    }
}