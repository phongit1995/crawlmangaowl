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
const USER_ARGENT=process.env.USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36";
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
            args : ['--no-sandbox', '--disable-setuid-sandbox',`--proxy-server=${newProxyUrl}`]
        });
    }else {
        browser = await puppeteer.launch({
            args : ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    
    const page = await browser.newPage();
    await page.setUserAgent(USER_ARGENT);
    await page.authenticate();
    await page.goto("https://mangaowl.com/single/69034/another-world-where-i-can-t-even-collapse-and-die",{
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
        if (count++ === 10) {
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
const getAllHtml =async (url)=>{
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