// todo delete all expired cookies at some point?
//todo misc bugs
// -doesn't recognise module

const EXPIRY_TIME = 480000; // 8 minutes
const MAX_PAGES = 10;
const BIN_1 = 3;
const BIN_2 = 10;

module.exports.parseLinkHeader = parseLinkHeader;
module.exports.getNPages = getNPages;
module.exports.addCookie = addCookie;
module.exports.getCookie = getCookie;
module.exports.cluster = cluster;
module.exports.max = max;

/**
 * Add to the given data the number of commits by each author in the given repo
 * @param repo repo to query
 * @param token OAuth token for query
 * @param data data to add to
 * @returns updated data
 */
async function getNCommitsByAuthor(repo, token, data) {
    // commits data is comprised of a list of pages of commits
    // each of which has an author 'login'

    console.log('getting n commits by author');
    let url = 'https://api.github.com/repos/' + repo + '/commits';
    let promises = await queryEachPage(url, token);
    for (const promise of promises) {
        let text = promise.value;
        for (let i = 0; i < text.length; i++) {
            let author;
            try {
                author = text[i]['author']['login'];
            } catch (e) {
                console.error(e);
                continue;
            }
            if (!data[author]) data[author] = {commits:1};
            else if (!data[author].commits) data[author].commits=1;
            else data[author].commits++;
        }
    }
    return data;
}

/**
 * Add to the given data the number of issues resolved by each author in the given repo
 * @param repo repo to query
 * @param token OAuth token for query
 * @param data data to add to
 * @returns updated data
 */
async function getNIssuesResolvedByAuthor(repo, token, data) {
    // issues data is comprised of a list of pages of issues,
    // each of which has a list of pages of events
    // each of which has an 'actor' who closed the issue

    console.log('getting n issues resolved by author');
    let url = 'https://api.github.com/repos/' + repo + '/issues?state=closed';

    // query each issue page, waiting for all to respond
    let promises = await queryEachPage(url, token);

    // then for each issue page, query their event pages
    let promisesPages = [];
    for (const promise of promises) {
        let text = promise.value;
        for (let i = 0; i < text.length; i++) {
            let num;
            try {
                num = text[i]['number'];
            } catch (e) {
                console.error(e);
                continue;
            }
            console.log("pinging issue events");
            let url = 'https://api.github.com/repos/' + repo + '/issues/' + num + '/events';
            promisesPages.push(queryEachPage(url, token));
        }
    }

    // wait for each list of event pages to respond
    await Promise.allSettled(promisesPages).then(promiseEventsPages => {

        // then for each list of event pages, find the user who closed the issue
        for (const promisesEventsPage of promiseEventsPages) {
            const promiseEvents = promisesEventsPage.value;
            for (const promiseEvent of promiseEvents) {
                let events = promiseEvent.value;
                let author;
                try {
                    const closedEvent = events.find(e => e['event'] === "closed");
                    const actor = closedEvent['actor'];
                    author = actor['login'];
                } catch (e) {
                    console.error(e);
                    continue;
                }
                if (!data[author]) data[author] = {issues:1};
                else if (!data[author].issues) data[author].issues=1;
                else data[author].issues++;
            }
        }
    });
    return data;
}

/**
 * Add to the given data the number of pull requests reviewed by each author in the given repo
 * @param repo repo to query
 * @param token OAuth token for query
 * @param data data to add to
 * @returns updated data
 */
async function getNPullRequestsReviewedByAuthor(repo, token, data) {
    // pull request data is comprised of a list of pages of pull requests,
    // each of which has a list of pages of reviews
    // each of which has an author 'login'

    console.log('getting n pull requests reviewed by author');
    let url = 'https://api.github.com/repos/' + repo + '/pulls?state=closed';

    // query each pull request page, waiting for all to respond
    let promises = await queryEachPage(url, token);

    // then for each pull request page, query their review pages
    let promisesPages = [];
    for (const promise of promises) {
        let text = promise.value;
        for (let i = 0; i < text.length; i++) {
            let num;
            try {
                num = text[i]['number'];
            } catch (e) {
                console.error(e);
                continue;
            }
            console.log("pinging pull request reviews");
            let url = 'https://api.github.com/repos/' + repo + '/pulls/' + num + '/reviews';
            promisesPages.push(queryEachPage(url, token));
        }
    }

    // wait for each list of review pages to respond
    await Promise.allSettled(promisesPages).then(promiseReviewsPages => {

        // then for each list of review pages, for each review, find their author
        for (const promiseReviewPage of promiseReviewsPages) {
            const promiseReviews = promiseReviewPage.value;
            for (const promiseReview of promiseReviews) {
                const reviews = promiseReview.value;
                for (const review of reviews) {
                    let author;
                    try {
                        author = review['user']['login'];
                    } catch (e) {
                        console.error(e);
                        continue;
                    }
                    if (!data[author]) data[author] = {pullRequests:1};
                    else if (!data[author].pullRequests) data[author].pullRequests=1;
                    else data[author].pullRequests++;
                }
            }
        }
    });
    return data;
}

/**
 * Pings each page of a GitHub API query
 * @param url url to query GitHub API
 * @param token GitHub token for query
 * @return responses from the query
 */
async function queryEachPage(url, token) {
    if (!url.includes("?")) url = url.concat("?per_page=50");
    else url = url.concat("&per_page=50");

    const nPages = await getNPages(url, token);

    let promises = [];
    for (let i = 1; i <= nPages; i++) {
        console.log("pinging page " + i);
        let pageUrl = url + "&page=" + i;
        promises.push(
            fetch(pageUrl, {
            method: 'GET',
            headers: {Authorization: 'token ' + token}
            })
            .then(response=>{
                if (!response.ok) return {};
                console.log('got response');
                return response.json();
            })
        );
    }
    return Promise.allSettled(promises);
}

/**
 * Find the number of pages for a given url
 * @param url url to find number of pages of
 * @param token OAuth token for query
 * @returns number of pages if valid header for the given url
 */
async function getNPages(url, token) {
    let header = await fetch(url, {
        method: 'GET',
        headers: {Authorization: 'token ' + token}
        })
        .then(response=>{
            if (!response.ok) return {};
            return response.headers.get('link');
        });

    if (header) {
        if (!header.includes('rel="last"')) return null;
        const map = parseLinkHeader(header);
        if (!map) return null;
        const url = map.get('last')
        return parseInt(url.split('&page=')[1]);
    }
    return 1;
}

/**
 * Create a map for a GitHub API link header,
 * which may contain some combination of rel's; the next, previous, first, and last page.
 * @param header link header to be parsed
 * @returns map of rel:url if header is valid, otherwise null
 */
function parseLinkHeader(header) {
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

/**
 * Gets the OAuth token
 * If a new token is inputted, a cookie is created for it
 * @returns token newly inputted by the user if it exists;
 * otherwise cookie token if it exists;
 * otherwise undefined
 */
function getToken() {
    const tokenCookie = getCookie('token');
    let token = document.getElementById('token').value;
    if (token !== '') {
        document.cookie = undefined; // clear cookies
        addCookie('token',{value:token});
    } else {
        if (tokenCookie) {
            token = tokenCookie.value;
        } else {
            return undefined;
        }
    }
    return token;
}

/**
 * On 'Submit' button clicked,
 * gets and displays data for some user inputted GitHub repository and OAuth token
 */
async function run() {
    const repo = document.getElementById('repo').value;
    if (!repo) {
        alert("repo not entered");
        return;
    }
    const token = getToken();
    if (!token) {
        alert("token expired/not entered");
        return;
    }

    if (!await isValidQuery(repo, token)) {
        alert("invalid query");
        return;
    }

    document.getElementById("loader").style.visibility = "visible";
    document.getElementById('repo').value = '';
    document.getElementById('token').value = '';

    const data = await getData(repo, token);
    console.log("done");
    addCookie(repo, data);//todo this isn't updating expiry when repo cookie already exists?
    const clusters = cluster(data, v => {
        if (v) return v.commits + v.issues + v.pullRequests;
    });
    display(clusters);

    document.getElementById("loader").style.visibility = "hidden";
    document.getElementById('oauthButton').style.display = 'block';
    document.getElementById('oauthText').style.display = 'none';
    document.getElementById('token').style.display = 'none';
}

async function isValidQuery(repo, token) {
    const url = 'https://api.github.com/repos/'+repo;
    return await fetch(url, {
        method: 'GET',
        headers: {Authorization: 'token ' + token}
        })
        .then(response=>{
            if (!response.ok) return null;
            return response.json();
        });
}

/**
 * Gets data from the given repo
 * -number of commits by each author
 * -number of issues resolved by each author
 * -number of pull requests reviewed by each author
 * @param repo repo to be queried
 * @param token OAuth token for query
 * @returns data collected
 */
async function getData(repo, token) {
    const repoCookie = getCookie(repo);
    if (repoCookie) return repoCookie;

    let data = {}; // data is accumulated by each get function
    data = await getNCommitsByAuthor(repo, token, data);
    data = await getNIssuesResolvedByAuthor(repo, token, data);
    data = await getNPullRequestsReviewedByAuthor(repo, token, data);
    let sortArr = [];
    for (const k in data) {
        const v = data[k];
        if (!v.commits) v.commits=0;
        if (!v.issues) v.issues=0;
        if (!v.pullRequests) v.pullRequests=0;
        const sum = v.commits + v.issues + v.pullRequests;
        sortArr.push([k,sum]);
    }
    sortArr.sort((a,b)=>b[1]-a[1]);
    let sortedData = {};
    for (const a of sortArr) {
        const k = a[0];
        sortedData[k] = data[k];
    }
    return sortedData;
}

/**
 * Adds the given key-value pair to the cookie
 * Note that changing EXPIRY_TIME won't change the expiry time of existing cookies
 * @param key key to add
 * @param value value to add
 * @returns new cookie if valid key & value, otherwise null
 */
function addCookie(key, value) {
    if (!key || !value) {
        console.log('appending cookie failed');
        return null;
    }

    console.log('appending cookie from - to -');

    let cookie = {};
    if (document.cookie && document.cookie !== 'undefined')
        cookie = JSON.parse(document.cookie);
    console.log(cookie);

    let newCookie = cookie;

    newCookie[key] = {value:value};
    let d = new Date();
    newCookie[key].expires = d.getTime() + EXPIRY_TIME;

    document.cookie = JSON.stringify(newCookie);
    console.log(newCookie);
    return newCookie;
}

/**
 * Gets the cookie value associated with the given key
 * @param key key to find cookie value
 * @returns value of cookie if found and not expired, otherwise undefined
 */
function getCookie(key) {
    try {
        const cookie = JSON.parse(document.cookie);
        if (cookie.hasOwnProperty(key)) {
            console.log('found cookie for ' + key);
            let d = new Date();
            if (d.getTime() > cookie[key].expires) {
                console.log('cookie expired');
                return undefined;
            }
            console.log(cookie);
            return cookie[key].value;
        }
        console.log("didn't find cookie for " + key);
        return undefined;
    } catch (e) {return undefined;}
}

/**
 * Organises the given data into 3 bins of [data <= 3, 3 < data <= 10, data > 10].
 * Given data must be ordered high-low,
 * and contain numbers to be clustered by as described by the function 'num'
 * @param data data to be clustered
 * @param num function which returns the number value for each datum
 * @returns array of 3 bins;
 * will return empty values where a number can't be found;
 * returns null if num is null/undefined
 */
function cluster(data, num=datum=>datum) {
    if (!num) return null;
    let clusters = [{},{},{}];
    if (!data) return clusters;
    let temp = JSON.parse(JSON.stringify(data)) // copy of data
    for (const k in data) {
        if (!temp.hasOwnProperty(k)) continue;
        const datum = temp[k];
        const val = num(datum);
        if (!val) return null;
        if (val > BIN_2) clusters[0][k]=datum;
        else if (val > BIN_1) clusters[1][k]=datum;
        else if (val <= BIN_1) break;
        delete temp[k];
    }
    if (temp) clusters[2]=temp;
    return clusters;
}

/**
 * returns the max number value in an object and its children
 * @param obj object to find max number of
 * @returns {number} max number in obj
 */
function max(obj) {
    let m = -Infinity;
    if (obj) {
        for (const k in obj) {
            if (obj.hasOwnProperty(k)) {
                const v = obj[k];
                if (typeof v === 'number') {
                    m = Math.max(m, v);
                } else if (typeof v === 'object' && v !== null) {
                    m = Math.max(m, max(v));
                }
            }
        }
    }
    return m;
}

/**
 * Displays the given data as a list of split bar charts
 * @param data data to be displayed split into clusters
 */
function display(data) {
    let foundData = false;
    for (const datum of data) {
        if (datum.length !== 0) {
            foundData = true;
            break;
        }
    }
    if (!foundData) {
        alert('no data found!');
        return;
    }

    const dataTypes = ['','Author','No. commits','No. issues resolved',' No. pull requests reviewed'];
    const clusters =[];
    for (let i = 0; i < data.length; i++) {
        clusters.push('Cluster ' + (i+1));
    }
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

    for (let i = 0; i < data.length; i++) {

        // delete old bar column
        d3.select('#row'+i)
            .remove();

        const authors = Object.keys(data[i]);

        if (authors.length === 0) continue;

        d3.select('body')
            .append('p');

        const rows = d3.select('body')
            .append('div')
            .attr("id",'row'+i)
            .classed('row',true);

        // clusters column
        rows.append('p')
            .text(() => clusters[i])
            .style("width", () => `${width-margin}px`)
            .style('margin-right', () => `${margin}px`)
            .style('display', () => 'inline-block')

        // authors column
        rows.append("div")
            .style("width", () => `${width - (2 * margin)}px`)
            .classed("author-column", true)
            .selectAll("p")
            .data(authors)
            .enter()
            .append("p")
            .style('margin', () => `${margin}px`)
            .text(d => d);

        append(rows, width, margin, authors, xScale, d=>data[i][d].commits);
        append(rows, width, margin, authors, xScale, d=>data[i][d].issues);
        append(rows, width, margin, authors, xScale, d=>data[i][d].pullRequests);
    }
}

/**
 * Appends a row of bars associated with a given list of keys to a given row
 * @param rows rows div to be added to
 * @param width with of the bar column
 * @param margin margin of the bar column
 * @param keys keys for each row
 * @param xScale scale of the bar column
 * @param getVal function to find the value associated with each key
 */
function append(rows, width, margin, keys, xScale, getVal) {
    rows.append('div') // keys
        .style("width", () => `${width-margin}px`)
        .style('margin-right', () => `${margin}px`)
        .selectAll("div")
        .data(keys)
        .enter()
        .append("div") // bar background
        .style("width", () => `${width - margin}px`)
        .style("margin", () => `${margin}px`)
        .classed("background", true)
        .append("div") // bar
        .style("width", key => `${xScale(getVal(key))}px`)
        .classed("pull-request-bar", true)
        .append("p") // bar text
        .style("margin-left", () => `${margin}px`)
        .text(key => getVal(key))
        .classed("label", true);
}

/**
 * On 'New OAuth token' button clicked,
 * allow user to input a new OAuth token
 */
function newOAuth() {
    document.getElementById('oauthButton').style.display='none'
    document.getElementById('oauthText').style.display='inline'
    document.getElementById('token').style.display='inline'
}