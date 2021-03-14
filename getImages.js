const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
require("dotenv").config();
let request = require('request-promise');
let requestBT = require('request');
let cheerio = require('cheerio');
const cacheMemory = require('memory-cache');
let fs = require("fs");
let path = require('path');
const  { isCloudflareJSChallenge ,makeId} = require('./common');
const REFERER ="https://mangaowl.com/";
const listUserAgent = JSON.parse(fs.readFileSync(path.join(__dirname,"./userAgent.json"),'utf-8'));
const USER_ARGENT=process.env.USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/93.0.148 Chrome/87.0.4280.148 Safari/537.36";
puppeteer.use(StealthPlugin());
const getCookieCloudflare=async(proxy)=>{
    const KEY_CACHE="KEY_CACHE"+proxy;
    const dataCache = cacheMemory.get(KEY_CACHE);
    if(dataCache){
        return dataCache;
    }
    let newProxyUrl ,  browser;
    if(proxy){
        newProxyUrl = await proxyChain.anonymizeProxy(proxy);
        browser = await puppeteer.launch({
            args : ['--no-sandbox', '--disable-setuid-sandbox',`--proxy-server=${newProxyUrl}`],
            //headless: false
        });
    }else {
        browser = await puppeteer.launch({
            args : ['--no-sandbox', '--disable-setuid-sandbox'],
            // headless: false
        });
    }
    
    const page = await browser.newPage();
    await page.setUserAgent(USER_ARGENT);
    await page.authenticate();
    await page.goto("https://mangaowl.com/single/20028/hyakunen-kesshou-mokuroku",{
        timeout:45000,
        waitUntil: 'domcontentloaded'
    })
    
    let count = 1;
    let content = await page.content();
    while(isCloudflareJSChallenge(content)){
        response = await page.waitForNavigation({
            timeout: 50000,
            waitUntil: 'domcontentloaded'
        });
        content = await page.content();
        if (count++ === 20) {
          throw new Error('timeout on just a moment');
        }
    }
    const cookies = await page.cookies();
    let result ="";
    for(let cookie of cookies){
        result+= `${cookie.name}=${cookie.value};` ;
    }
    if(newProxyUrl){
        await proxyChain.closeAnonymizedProxy(newProxyUrl, true);
    }
    await browser.close();
    cacheMemory.put(KEY_CACHE,result,1000*60*30);
    console.log(result);
    return result ;

}
const getCookieCloudflareHome=async(url,proxy)=>{
    const KEY_CACHE="KEY_CACHE"+"Home";
    const dataCache = cacheMemory.get(KEY_CACHE);
    let newProxyUrl ,  browser;
    if(proxy){
        newProxyUrl = await proxyChain.anonymizeProxy(proxy);
        browser = await puppeteer.launch({
            args : ['--no-sandbox', '--disable-setuid-sandbox',`--proxy-server=${newProxyUrl}`],
            //headless: false
        });
    }else {
        browser = await puppeteer.launch({
            args : ['--no-sandbox', '--disable-setuid-sandbox'],
            // headless: false
        });
    }
    console.log(url);
    const page = await browser.newPage();
    await page.setUserAgent(USER_ARGENT);
    await page.authenticate();
    await page.goto(url,{
        timeout:45000,
        waitUntil: 'domcontentloaded'
    })
    
    let count = 1;
    let content = await page.content();
    while(isCloudflareJSChallenge(content)){
        response = await page.waitForNavigation({
            timeout: 50000,
            waitUntil: 'domcontentloaded'
        });
        content = await page.content();
        if (count++ === 20) {
          throw new Error('timeout on just a moment');
        }
    }
    if(newProxyUrl){
        await proxyChain.closeAnonymizedProxy(newProxyUrl, true);
    }
    const cookies = await page.cookies();
    console.log(cookies);
    let result ="";
    for(let cookie of cookies){
        result+= `${cookie.name}=${cookie.value};` ;
    }
    cacheMemory.put(KEY_CACHE,result,1000*60*30);
    let data = await page.content()
    await browser.close();
    return data ;
}
const ListImages = async (url)=>{
    const KEY_CACHE="KEY_CACHE"+url;
    const dataCache = cacheMemory.get(KEY_CACHE);
    if(dataCache){
        return dataCache;
    }
    const cookie = await getCookieCloudflare();
    let options = {
        method:"get",
        uri:url,
        headers:{
            Referer:REFERER,
            'User-Agent': USER_ARGENT,
            cookie:cookie
        }
    }
    let data = await request(options);
    let $ = cheerio.load(data);
    let listImage = [];
    console.log($(".item>img").length);
    $(".item>img").each(function(){
        let image=$(this).attr("data-src").trim()|| $(this).attr("src") ;
        listImage.push(image);
    })
    const URL_FOLDER =makeId(6);
    let urlPath  = path.join(__dirname,"public",URL_FOLDER) ;
    if (!fs.existsSync(urlPath)){
        fs.mkdirSync(urlPath,{recursive: true});
    }
    if(urlPath){
        let ArrayPromise = listImage.map((item,index)=>{
            return SaveImages(item,urlPath,index,URL_FOLDER);
        })
        let resultPromise = await Promise.all(ArrayPromise);
        cacheMemory.put(KEY_CACHE,resultPromise,1000*60*60*12);
        return resultPromise;
    }

}
const getAllHtml =async (cookie,url)=>{
    console.log(cookie);
    let options = {
        method:"GET",
        uri:url,
        headers:{
            Referer:"https://mangaowl.com/",
            'User-Agent': USER_ARGENT,
            cookie:cookie
        },
        referrerPolicy: "strict-origin-when-cross-origin",
    }
    console.log(options);
    let data = await request(options);
    console.log(data);
    return data ;
}
const SaveImages = (urlImages,urlPath,index,nameComic)=>{
    return new Promise(async(resolve,reject)=>{
        let extendFile = urlImages.slice(urlImages.lastIndexOf("."),urlImages.length);
        const cookie = await getCookieCloudflare();
        let options = {
            method:"GET",
            uri:urlImages,
            headers:{
                Referer:REFERER,
                'User-Agent': USER_ARGENT,
                cookie:cookie
            }
        }
        let fileName= makeId(8)+".jpeg";
        let FileUrl = path.join(urlPath,fileName);
        let fileStream = fs.createWriteStream(FileUrl);
        requestBT(options).pipe(fileStream);
        fileStream.on("finish",()=>{
            resolve( `${nameComic}/${fileName}`);
        })
        fileStream.on("error",(error)=>{
            reject(error);
        })
    })
    
}
module.exports.ListImages =ListImages ;
module.exports.getCookieCloudflare = getCookieCloudflare ;
module.exports.getAllHtml =getAllHtml ;
module.exports.getCookieCloudflareHome = getCookieCloudflareHome ;