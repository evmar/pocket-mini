var API = {
  /**
   * Make an API call.
   * @param path Path under the /v3/ namespace in the getpocket API.
   * @param data Object of data to pass to the API.
   *   See Auth.addToAPIRequest for adding credentials to data.
   * @return A Promise that resolves to the JSON result object.
   */
  call: function(path, data) {
    return new Promise(function(resolve, reject) {
      var req = new XMLHttpRequest();
      req.onload = function() {
        if (req.status != 200) {
          reject(Error(req.statusText));
          return;
        }
        resolve(JSON.parse(req.responseText));
      };
      req.onerror = function() {
        reject(Error("XHR error"));
      };
      req.open('POST', 'https://getpocket.com/v3/' + path);
      req.setRequestHeader('Content-Type', 'application/json; charset=UTF8');
      req.setRequestHeader('X-Accept', 'application/json');
      req.send(JSON.stringify(data));
    });
  },

  /**
   * Add a URL to pocket.
   * See http://getpocket.com/developer/docs/v3/add .
   * @param url URL to add.
   * @return A Promise of the API call result.
   */
  add: function(url) {
    var data = {url:url};
    Auth.addToAPIRequest(data);
    return API.call('add', data).then(function(data) { return data.item; });
  }
};

var Auth = {
  consumerKey: '30559-c9bebc6f13a469d6e6417b38',
  redirectUri: chrome.extension.getURL('auth.html'),

  storageKey: {
    requestToken: 'request_token',
    accessToken: 'access_token',
    username: 'username',
  },

  /**
   * @return True if the auth setup flow needs to run.
   */
  isNeeded: function() {
    return localStorage[Auth.storageKey.accessToken] == null;
  },
  
  /**
   * Run the auth flow.
   * Can't return a promise because the auth flow may involve opening a tab
   * etc. and we can't wait for that event (?).
   */
  go: function() {
    return Auth.getRequestToken().then(function(token) {
      Auth.getUserPermission(token);
    });
  },

  /**
   * Start the oauth flow.
   * @return A Promise that resolves to a new oauth request code.
   */
  getRequestToken: function() {
    var payload = {
      consumer_key: Auth.consumerKey,
      redirect_uri: Auth.redirectUri,
    };
    return API.call('oauth/request', payload).then(function(data) {
      return data.code;
    });
  },

  /**
   * Ask the user to authorize the app.
   * Opens a window that eventually causes authcallback.js to be loaded.
   * Stashes the request token in localStorage for use in
   * onGotUserPermission.
   * @param token A token as produced by getRequestToken.
   */
  getUserPermission: function(token) {
    localStorage[Auth.storageKey.requestToken] = token;
    var url = 'https://getpocket.com/auth/authorize' +
      '?request_token=' + token +
      '&redirect_uri=' + Auth.redirectUri;
    window.open(url);
  },

  /**
   * Called when the user has authorized the app.
   * Relies on the request token in localStorage from getUserPermission.
   * @return A Promise that resolves when the access token/username have
   *   been saved.
   */
  onGotUserPermission: function() {
    var requestToken = localStorage[Auth.storageKey.requestToken];
    return Auth.getAccessToken(requestToken).then(function(data) {
      localStorage.removeItem(Auth.requestTokenStorageKey);
      localStorage[Auth.storageKey.accessToken] = data.access_token;
      localStorage[Auth.storageKey.username] = data.username;
    });
  },

  /**
   * Get an access token from a request token.
   * Requires that the user has authorized the app, see getUserPermission.
   * @param requestToken A request token, as produced by getRequestToken.
   * @return A Promise that resolves to an access payload, which is an
   *   object containing 'access_token' and 'username' fields.
   */
  getAccessToken: function(requestToken) {
    var payload = {
      consumer_key: Auth.consumerKey,
      code: requestToken,
    };
    return API.call('oauth/authorize', payload);
  },

  /**
   * Add auth metadata to an API request object.
   * Auth.isNeeded() must have returned false for this to work.
   * @param req An object of request data to pass to API.call.
   */
  addToAPIRequest: function(req) {
    req['consumer_key'] = Auth.consumerKey;
    req['access_token'] = localStorage[Auth.storageKey.accessToken];
  },
};
