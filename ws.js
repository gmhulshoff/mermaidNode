const mods = [ 'http:createServer', 'url:parse', 'fs:existsSync,readFileSync,writeFileSync', './sql:connect'].reduce((a, c) => {
  [m, p] = c.split(':')
  const mod = require(m)
  return { ...a, ...p.split(',').reduce((a1, c1) => ({...a1, [c1]: mod[c1]}), {}) }
}, {port: (process.argv && process.argv[2]) || 3000, OK: 200, NOTFOUND: 404 })
const { createServer, parse, existsSync, readFileSync, writeFileSync, connect, port, OK, NOTFOUND } = mods
const mimes = JSON.parse(`${readFileSync('./mermaid/mimes.json')}`)

createServer((req, res) => {
  const sql = (db, sql, ondone) => { readRows(db, sql, rows => ondone(JSON.stringify(rows))) }
  const file = (path, ondone) => ondone(existsSync(path) ? readFileSync(path) : `${path} not found`)
  const readRows = (db, sql, onresult) => connect(db, sql, onresult)
  const refreshModel = (sql, dbs) => {
    readRows(dbs[0], sql, local => {
      const process = r => JSON.parse(r[0].trim().slice(0, -1))
      writeFileSync(`./mermaid/${dbs[0]}.json`, JSON.stringify(local.map(r => process(r)), null, 2))
      readRows(dbs[1], sql, central => writeFileSync(`./mermaid/${dbs[1]}.json`, JSON.stringify(central.map(r => process(r)), null, 2)))
    })
    const sep = '\n'
    return dbs
      .reduce((a, c) => `${a}${sep}${c}(er.sql) Completed`, '')
      .substr(sep.length)
  }
  console.log(req.url)
  const parts = parse(req.url, true)
  const url = parts.pathname.toLowerCase()
  const ext = url == '/' ? '' : url.split('.').pop()
  const endRequest = (status, html) => {
    res.writeHead(status, {'Content-Type': mimes[ext] || 'text/plain'})
    res.end(html)
  }
  if (existsSync(__dirname + url)) endRequest(OK, readFileSync(__dirname + url))
  else if (url == '/api/refreshmodel') res.end(refreshModel(parts.query.src, parts.query.dbs))
  else if (url == '/api/sql') sql(parts.query.db, parts.query.sql, r => res.end(r))
  else if (url == '/api/file') file(parts.query.path, r => res.end(r))
  else endRequest(NOTFOUND, '{}')
}).listen(port)

console.log(`Server running at http://127.0.0.1:${port}/`)

