// Batch build and rebuild graphviz algorithmic diagrams as png for publication
// usage: sh seran-wiki.sh --allow-disclosure ../seran-dig/dig.ts

const { stat } = Deno;
import { readFileStr, writeFileStrSync, exists, existsSync } from "std/fs/mod.ts";
import * as wiki from "seran/wiki.ts";
import { asSlug } from "seran/wiki.ts";
import { ProcessStep } from "./step.ts";
import {
  isAbsolute,
  join,
  basename,
  normalize
} from "std/path/posix.ts";

export let plugins = [ "/client/process-step.mjs" ]
export let metaPages = {};

export let handler = new wiki.Handler()

handler.route("^/png/", (req) => {
  let path = join('../seran-dig/data',req.url)
  if (existsSync(path)) {
    wiki.serveFile(req,'image/png',path)
    return true
  }
  return false
})

handler.route("^/assets/", (req) => {
  let path = join('../seran-dig',req.url)
  if (existsSync(path)) {
    wiki.serveFile(req,'text/html',path)
    return true
  }
  return false
})

handler.items("Welcome Visitors", [
  "Welcome to this [[Seran Wiki]] Federation outpost.\
  From this page you can find who we are and what we do.",
  "Pages about us.",
  "[[Ward Cunningham]]",
  "Pages where we do and share.",
  "[[DIG Handbook]]"
])

handler.items("DIG Handbook", [
  "We consistency check the source possible translation problems.\
  Then we bulk generate graphviz images for print publication as pdf.",
  wiki.roster("Related Sites\n\ndig.wiki.innovateoregon.org\ndayton.fed.wiki\ndig.seran.c2.com\ndev2.wiki.innovateoregon.org\nthompson.wiki.innovateoregon.org\npath.ward.asia.wiki.org\nwellspring.fed.wiki\ncode.fed.wiki"),
  "[[Handbook Source]] to be built",
  "[[Run Batch Process]] when source changes",
  "[[Diagrams Processed]] with lasting png files",
  "[[Troubled Links]] that will be omitted",
  "[[Troubled Pages]] to be corrected",
  "[[Print to PDF]] when satisfied",
])

handler.items("Run Batch Process", [
  "Press Start to rerun diagrams before pringing a new version.\
  Return in a few minutes to confirm completion.",
  wiki.item("process-step", { text: "Fetch and process all pages.", href: "/rebuild" }),
  "Plugin needs help? Try this new client: \
  [http://dig.seran.c2.com/index.html?page=welcome-visitors&page=dig-handbook site]",
])

handler.items("Print to PDF", [
  "We use an html script to complete the assembly of text and images for printing.\
  See console log for source of missing page references.",
  "dig.seran.c2.com: [http://dig.seran.c2.com/assets/dig.html dig.html]",
  "dig.localhost:8000: [http://dig.localhost:8000/assets/dig.html dig.html]"
])

function asmap (array) {
  const bemap = (map, each) => {map[asSlug(each.title)] = each; return map}
  return array.reduce(bemap, {})
}

function json (url) {
  return fetch(url)
    .then(res => res.json())
}


let site = 'https://dig.wiki.innovateoregon.org'
let sitemap = []
let pageinfo = {}
let pages = {}

let wrote = []
let skipped = []
let missing = []
let unreachable = []
let trouble = {}
let lastrun = new Date(0)


async function mkdir (path) {
  if (!await exists(path)) {
    console.log(`Creating: ${path}`)
    await Deno.mkdir(path)
  }
}

let dataDir = "../seran-dig/data"
await mkdir (`${dataDir}`)
await mkdir (`${dataDir}/dot`)
await mkdir (`${dataDir}/png`)

if (await exists(`${dataDir}/lastrun`)) {
  let stat = await Deno.stat(`${dataDir}/lastrun`);
  lastrun = new Date(stat.modified * 1000)
}


// L I V E   R E P O R T S

handler.items('Handbook Source', async () => {
  let sitemap = await json(`${site}/system/sitemap.json`)
  return [
    "Before we start we check to see if our source has been updated since our last build.",
    "Sitemap information.",
    `[${site} ${site}]`,
    `${sitemap.length} pages`,
    "Last Site Update:",
    `${new Date(sitemap.reduce((m,i) => Math.max(m,i.date),0))}`,
    "Last Build Finished (now trustworthy if recent)",
    `${lastrun}`
  ]})

handler.items('Troubled Links', () => [
  "Having fetched every page we then check that each is accessible by links from Welcome Visitors and that all links can be resolved by these pages.",
  "Pages missing from source site",
  `${missing.map(t=>`[[${t}]]`).join(', ')}`,
  "Pages unreachable from welcome page",
  `${unreachable.map(t=>`[[${t}]]`).join(', ')}`
])

handler.items('Diagrams Processed', () => [
  "We run one of two versions of preview-next-diagram choosing left-right or top-bottom and save the resulting images as png.",
  "Pages with diagrams",
  `${wrote.map(t=>`[[${t}]]`).join(', ')}`,
  "Pages without diagrams",
  `${skipped.map(t=>`[[${t}]]`).join(', ')}`
])

function troubled_pages (key) {
  return [
    key,
    trouble[key].map(title => `[[${title}]]`).join(', ')
  ]
}

handler.items('Troubled Pages', () => {
  return [
    "We examine the markup of every referenced page and report things that look like trouble here.",
    ...Object.keys(trouble).flatMap(troubled_pages)
  ]
})

// http://path.ward.asia.wiki.org/assets/page/production-tools/images/designed-ingenuity-dig.png

let text =
`DOT strict digraph

  rankdir=TB

  node [style=filled fillcolor=white penwidth=5 color=black]
  HERE NODE

    node [style=filled fillcolor=white]
    WHERE /^Next/
      LINKS HERE -> NODE
          node [style=filled fillcolor=white]
          HERE NODE
            WHERE /^Next/
              LINKS HERE -> NODE

    node [style=filled fillcolor=white penwidth=3 color=black]
    LINKS HERE -> NODE
       node [style=filled fillcolor=white penwidth=1 color=black]
       HERE NODE
         LINKS HERE -> NODE`

// (cd data
//   for i in *
//     do echo $i
//     cat $i | \
//       dot -Tpng | \
//         ssh asia 'cat > .wiki/path.ward.asia.wiki.org/assets/page/production-tools/images/'$i'.png'
// done)

let rebuild = new ProcessStep('rebuild', false, build).control(metaPages)

async function build () {

  wrote = []
  skipped = []
  missing = []
  unreachable = []
  trouble = {}
  lastrun = new Date()
  sitemap = await json(`${site}/system/sitemap.json`)

  try {


  await rebuild.step(`fetch ${sitemap.length} pages`)
  pageinfo = asmap(sitemap)
  pages = await Promise.all(sitemap.map(each => json(`${site}/${each.slug}.json`)))
        .then(all => {return asmap(all)})

  await rebuild.step(`render diagrams as png`)
  for (let slug in pages) {
    let page = pages[slug]
    let graphviz = page.story.find(i => i.type == 'graphviz')
    if (graphviz) {
      let markup = graphviz.text.match(/tall/) ? text.replace('TB','LR') : text
      let dot = await makedot(page, {type:'graphviz', text:markup})
      writeFileStrSync(`${dataDir}/dot/${slug}.dot`, dot)
      let proc = Deno.run({cmd:["dot","-Tpng", `${dataDir}/dot/${slug}.dot`,`-o${dataDir}/png/${slug}.png`]})
      let status = await proc.status()
      if (!status.success) console.log('dot',slug,status)
      wrote.push(page.title)
    } else {
      skipped.push(page.title)
    }
  }

  await rebuild.step('upload png files')
  try {
    let pubsite='path.ward.asia.wiki.org'
    let assets='page/production-tools/images'
    let proc2 = Deno.run({cmd:["rsync", "-avz", `${dataDir}/png/`, `asia:.wiki/${pubsite}/assets/${assets}/`]})
    let status2 = await proc2.status()
    if (!status2.success) console.log('rsync',status2)
  } catch (e) {
    console.log('rsync catch', e)
  }

  await rebuild.step('find missing or unreachable titles')
    let more = ["Welcome Visitors"]
    let done = []
    function visit(title) {
      if (!done.includes(title)) {
        done.push(title)
        let slug = asSlug(title)
        let page = pages[slug]
        const hate = (m) => {
          trouble[m]=trouble[m]||[];
          if(!trouble[m].includes(title)) trouble[m].push(title)
        }
        if (page) {
          for (let item of page.story||[]) {
            if (['paragraph','markdown'].includes(item.type)) {
              for (let link of (item.text||'').matchAll(/\[\[(.*?)\]\]/g)) {
                if (link[1] && !done.includes(link[1])) {
                  more.push(link[1])
                }
                if (link[1] && !pageinfo[asSlug(link[1])]) {
                  hate(`Links to missing '${link[1]}' omitted`)
                }
              }
            } else if(['graphviz','html'].includes(item.type)) {
              if (!(item.text.startsWith('DOT FROM')||item.text.startsWith('<img'))) {
                hate(`Pages with unexpected '${item.type}' items`)
              }
            } else {
              hate(`Pages with '${item.type}' items omitted`)
            }
          }
        } else {
          if (!missing.includes(title)) missing.push(title)
        }
      }
    }
    while(more.length) {
      visit(more.shift())
    }
    for (let info of sitemap) {
      if (!done.includes(info.title)) unreachable.push(info.title)
    }

    writeFileStrSync(`${dataDir}/lastrun`, '')
    lastrun = new Date()

  } catch(e) {
    console.log('exception in build', e)
  }

}


async function makedot(page, item) {
  var m
  var text = item.text
  // if (m = text.match(/^DOT FROM ([a-z0-9-]+)($|\n)/)) {
  //   let site = $item.parents('.page').data('site')||location.host
  //   let slug = m[1]
  //   // let page = $item.parents('.page').data('data')
  //   let poly = await polyget({name: slug, site, page})
  //   if (page = poly.page) {
  //     let redirect = page.story.find(each => each.type == 'graphviz')
  //     if (redirect) {
  //       text = redirect.text
  //     }
  //   }
  //   if (text == item.text) {
  //     return trouble("can't do", item.text)
  //   }
  // }
  if (m = text.match(/^DOT ((strict )?(di)?graph)\n/)) {
    var root = tree(text.split(/\r?\n/), [], 0)
    // console.log('root',root)
    root.shift()
    // var $page = $item.parents('.page')
    // var here = $page.data('data')
    var here = page
    var context = {
      graph: m[1],
      name: here.title,
      // site: $page.data('site')||location.host,
      site: site,
      page: here,
      want: here.story.slice()
    }
    var dot = await evaluate(root, context, [])
    // console.log('dot', dot)
    return `${context.graph} {${dot.join("\n")}}`
  } else {
    return text
  }

  function tree(lines, here, indent) {
    while (lines.length) {
      let m = lines[0].match(/( *)(.*)/)
      let spaces = m[1].length
      let command = m[2]
      if (spaces == indent) {
        here.push(command)
        // console.log('parse',command)
        lines.shift()
      } else if (spaces > indent) {
        var more = []
        here.push(more)
        tree(lines, more, spaces)
      } else {
        return here
      }
    }
    return here
  }

  function quote (string) {
    return `"${string.replace(/ +/g,'\n')}"`
  }

  function trouble (text, detail) {
    // console.log(text,detail)
    throw new Error(text + "\n" + detail)
  }

  function collaborators (journal, implicit) {
    // usage: collaborators(page.journal, [site, item.site, location.host])
    let sites = journal
      .filter(action=>action.site)
      .map(action=>action.site)
    sites.push(...implicit)
    sites.reverse()
    return sites
      .filter((site,pos)=>sites.indexOf(site)==pos)
  }

  // async function probe (site, slug) {
  //   if (site === 'local') {
  //     const localPage = localStorage.getItem(slug)
  //     if (!localPage) {
  //       throw new Error('404 not found')
  //     }
  //     return JSON.parse(localPage)
  //   } else {
  //     // get returns a promise from $.ajax for relevant site adapters
  //     return wiki.site(site).get(`${slug}.json`, () => null)
  //   }
  // }

  async function polyget (context) {
    if (context.name == context.page.title) {
      return {site: context.site, page: context.page}
    } else {
      let slug = asSlug(context.name)
      // let sites = collaborators(context.page.journal, [context.site, location.host, 'local'])
      // console.log('resolution', slug, sites)
      // for (let site of sites) {
      //   try {
      //     return {site, page: await probe(site,slug)}
      //   } catch (err) {
      //     // 404 not found errors expected
      //   }
      // }
      // return null
      return {site: context.site, page: pages[slug]}
    }
  }

  // function graphData(here, text) {
  //   // from https://github.com/WardCunningham/wiki-plugin-graph/blob/fb7346083870722a7fbec6a8dc1903eb93ff322c/client/graph.coffee#L10-L31
  //   var graph, left, line, merge, op, right, token, tokens, _i, _j, _len, _len1, _ref;
  //   merge = function(arcs, right) {
  //     if (arcs.indexOf(right) === -1) {
  //       return arcs.push(right);
  //     }
  //   };
  //   graph = {};
  //   left = op = right = null;
  //   _ref = text.split(/\n/);
  //   for (_i = 0, _len = _ref.length; _i < _len; _i++) {
  //     line = _ref[_i];
  //     tokens = line.trim().split(/\s*(-->|<--|<->)\s*/);
  //     for (_j = 0, _len1 = tokens.length; _j < _len1; _j++) {
  //       token = tokens[_j];
  //       if (token === '') {
  //       } else if (token === '-->' || token === '<--' || token === '<->') {
  //         op = token;
  //       } else {
  //         right = token === 'HERE' ? here : token;
  //         graph[right] || (graph[right] = []);
  //         if ((left != null) && (op != null) && (right != null)) {
  //           switch (op) {
  //             case '-->':
  //               merge(graph[left], right);
  //               break;
  //             case '<--':
  //               merge(graph[right], left);
  //               break;
  //             case '<->':
  //               merge(graph[left], right);
  //               merge(graph[right], left);
  //           }
  //         }
  //         left = right;
  //         op = right = null;
  //       }
  //     }
  //   }
  //   return graph;
  // }

  async function evaluate(tree, context, dot) {
    let deeper = []
    var pc = 0
    while (pc < tree.length) {
      let ir = tree[pc++]
      const nest = () => (pc < tree.length && Array.isArray(tree[pc])) ? tree[pc++] : []
      const peek = (keyword) => pc < tree.length && tree[pc]==keyword && pc++

      if (Array.isArray(ir)) {
        deeper.push({tree:ir, context})

      } else if (ir.match(/^[A-Z]/)) {
        // console.log('evaluate',ir)

        if (ir.match(/^LINKS/)) {
          let text = context.want.map(p=>p.text).join("\n")
          let links = (text.match(/\[\[.*?\]\]/g)||[]).map(l => l.slice(2,-2))
          let tree = nest()
          links.map((link) => {
            if (m = ir.match(/^LINKS HERE (->|--) NODE/)) {
              dot.push(`${quote(context.name)} ${m[1]} ${quote(link)}`)
            } else
            if (m = ir.match(/^LINKS NODE (->|--) HERE/)) {
              dot.push(`${quote(link)} ${m[1]} ${quote(context.name)}`)
            } else
            if (!ir.match(/^LINKS$/)) {
              trouble("can't do link", ir)
            }
            if (tree.length) {
              let new_context = Object.assign({},context,{name:link})
              new_context.promise = polyget(new_context)
              deeper.push({tree, context:new_context})
          }
          })
        } else

        // if (ir.match(/^GRAPH$/)) {
        //   for (let item of context.want) {
        //     if (item.type == 'graph') {
        //       let graph = graphData(context.name, item.text)
        //       let kind = context.graph.match(/digraph/) ? '->' : '--'
        //       for (let here in graph) {
        //         dot.push(`${quote(here)}`)
        //         for (let there of graph[here]) {
        //           dot.push(`${quote(here)} ${kind} ${quote(there)}`)
        //         }
        //       }
        //     }
        //   }
        // } else

        if (ir.match(/^HERE/)) {
          let tree = nest()
          let page = null
          let site = ''
          try {
            if(context.promise) {
              let poly = await context.promise
              site = poly.site
              page = poly.page
              delete context.promise
            } else {
              let poly = await polyget(context)
              site = poly.site
              page = poly.page
            }
          } catch (err) {}
          if (page) {
            if (ir.match(/^HERE NODE$/)) {
              dot.push(quote(context.name))
            } else
            if (ir.match(/^HERE NODE \w+/)) {
              let kind = context.graph.match(/digraph/) ? '->' : '--'
              dot.push(`${quote(ir)} ${kind} ${quote(context.name)} [style=dotted]`)
            } else
            if (!ir.match(/^HERE$/)) {
              trouble("can't do here", ir)
            }
            deeper.push({tree, context:Object.assign({},context,{site, page, want:page.story})})
          }
          if (peek('ELSE')) {
            let tree = nest()
            if (!page) {
              deeper.push({tree, context})
            }
          }
        } else

        if (ir.match(/^WHERE/)) {
          let tree = nest()
          var want = context.want
          if (m = ir.match(/\/.*?\//)) {
            let regex = new RegExp(m[0].slice(1,-1))
            want = want.filter(item => (item.text||'').match(regex))
          } else if (m = ir.match(/ FOLD ([a-z_-]+)/)) {
            var within = false
            want = want.filter((item) => {
              if (item.type == 'pagefold') {
                within = item.text == m[1]
              }
              return within
            })
          } else if (m = ir.match(/[a-z_]+/)) {
            let attr = m[0]
            want = want.filter(item => item[attr])
          } else trouble("can't do where", ir)
          deeper.push({tree, context:Object.assign({},context,{want})})
        } // else

        // if (ir.match(/^FAKE/)) {
        //   if (m = ir.match(/^FAKE HERE (->|--) NODE/)) {
        //     dot.push(`${quote(context.name)} ${m[1]} ${quote('post-'+context.name)}`)
        //   } else
        //   if (m = ir.match(/^FAKE NODE (->|--) HERE/)) {
        //     dot.push(`${quote('pre-'+context.name)} ${m[1]} ${quote(context.name)}`)
        //   } else trouble("can't do fake", ir)
        // } else

        // if (ir.match(/^LINEUP$/)) {
        //   let tree = nest()
        //   try {
        //     let $page = $item.parents('.page')
        //     let $lineup = $(`.page:lt(${$('.page').index($page)})`)
        //     $lineup.each((i,p) => {
        //       let site = $(p).data('site')||location.host
        //       let name = $(p).data('data').title
        //       deeper.push({tree, context:Object.assign({},context,{site, name})})
        //     })
        //   } catch {
        //     throw new Error("can't do LINEUP yet")
        //   }
        // } else trouble("can't do", ir)

      } else {
        // console.log('evaluate',ir.toString())
        dot.push(ir)
      }
    }

    for (var i=0; i<deeper.length; i++) {
      let child = deeper[i]
      await evaluate(child.tree, child.context, dot)
    }

    return dot
  }
}






