const proxy = require('http-proxy-middleware');

const pathRewrite = (p) =>  p;//{ console.log(`HIT ${p}`); return p }

module.exports = function(app) {
    app.use(proxy('/api', { target: 'http://localhost:4444', pathRewrite }));
    app.use(proxy('/sockets', { target: 'ws://localhost:4444', ws: true, pathRewrite  }));
};

