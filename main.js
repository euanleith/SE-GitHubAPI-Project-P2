function queryRepo() {
    const username = document.getElementById('username').value;
    const repo = document.getElementById('repo').value;
    if (username === '') {
        alert("user not entered")
        return false;
    }

    var url;
    if (repo === '')
        url = 'https://api.github.com/users/' + username; // get user
    else
        url = 'https://api.github.com/repos/' + username + '/' + repo // get repo

    const token = document.getElementById('token').value;

    const request = new XMLHttpRequest();
    request.open('GET', url, false);
    if (token !== '')
        request.setRequestHeader('Authorization', 'token ' + token);
    request.send();
    document.write(request.responseText);
    return true;
}