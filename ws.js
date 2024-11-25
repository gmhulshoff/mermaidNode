const mods = [ 'http:createServer', 'url:parse', 'fs:existsSync,readFileSync,writeFileSync', './sql:connect'].reduce((a, c) => {
  [m, p] = c.split(':')
  const mod = require(m)
  return { ...a, ...p.split(',').reduce((a1, c1) => ({...a1, [c1]: mod[c1]}), {}) }
}, {separator: '\n', port: (process.argv && process.argv[2]) || 3000, OK: 200, NOTFOUND: 404 })
const { createServer, parse, existsSync, readFileSync, writeFileSync, connect, port, OK, NOTFOUND, separator } = mods
const mimes = JSON.parse(`${readFileSync('./mermaid/mimes.json')}`)
const logger = { messages: []}

createServer((req, res) => {
  const body = { msg: '' }
  req.on('data', chunk => body.msg += `${chunk}`)
  req.on('end', () => next(req, res, body.msg))
}).listen(port)

function next(req, res, body) {
  const sql = (db, sql, withHeaders, ondone) => { readRows(db, sql, withHeaders, rows => ondone(JSON.stringify(rows))) }
  const file = (path, ondone) => ondone(existsSync(path) ? readFileSync(path) : `${path} not found`)
  const readRows = (db, sql, withHeaders, onresult) => connect(db, sql, withHeaders, onresult)
  const refreshModel = (sql, dbs) => {
    readRows(dbs[0], sql, local => {
      const process = r => JSON.parse(r[0].trim().slice(0, -1))
      writeFileSync(`./mermaid/${dbs[0]}.json`, JSON.stringify(local.map(r => process(r)), null, 2))
      readRows(dbs[1], sql, central => writeFileSync(`./mermaid/${dbs[1]}.json`, JSON.stringify(central.map(r => process(r)), null, 2)))
    })
    return dbs
      .reduce((a, c) => `${a}${separator}${c}(er.sql) Completed`, '')
      .substr(separator.length)
  }
  const parsedBody = unescape(body)
  console.log(req.url)
  const parts = parse(req.url, true)
  const url = parts.pathname.toLowerCase()
  const ext = url == '/' ? '' : url.split('.').pop()
  const endRequest = (status, html, contentType = mimes[ext] || 'text/plain') => {
    res.writeHead(status, {'Content-Type': contentType})
    res.end(html)
  }
  if (existsSync(__dirname + url)) endRequest(OK, readFileSync(__dirname + url))
  else if (url == '/log4http') {
    logMessages(parsedBody)
    endRequest(OK, parsedBody)
  }
  else if (url == '/logclear') { logger.messages = [];endRequest(OK, '') }
  else if (url == '/logmessages') endRequest(OK, JSON.stringify(logger.messages, null, 2), 'json')
  else if (url == '/api/refreshmodel') endRequest(OK, refreshModel(parts.query.src, parts.query.dbs))
  else if (url == '/api/sql') sql(parts.query.db, parts.query.sql, parts.query.withHeaders, r => res.end(r))
  else if (url == '/api/file') file(parts.query.path, r => res.end(r))
  else endRequest(NOTFOUND, '{}')
}

function logMessages(parsed) {
  let json = ''
  try{
    json = parsed
      .replace(/("Exception":")([\s\S]*?)(",)/g, (matched, c1, c2, c3, i, input) => 
        c1 + c2.replace(/ > /g, '\\n') + c3)
      .replace(/("Message":")([\s\S]*?)("__})/g, (matched, c1, c2, c3, i, input) => 
        c1 + c2.replace(/\"/g, "&quot;").replace(/\r/g, '').replace(/\n/g, '\\n') + '"}')
      .replace(/\+/g, ' ')
      .split('\r\n')
      .filter(line => line.length > 0)
      .map(line => line
        .replace(/\\/g, '\\\\')
        .replace(/&quot;/g, '\\"')
      )
      .join(',')
    const messages = JSON.parse('[' + json + ']')
    logger.messages.push(...messages)
  }catch (e) {
    console.log(json)
    console.log(e)
  }
}

console.log(`Server running at http://127.0.0.1:${port}/`)

