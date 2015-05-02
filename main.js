/*
 * Get fc2 shopping cart order mails from gmail, and it export as JSONP.
 * You can display your fc2 shopping cart order anysite you want.
 */
var CACHE_LIFE_SEC = 60 * 15; // update cache every 15min
var CACHE_KEY = 'json_cache';
var DEF_MAX_COUNT = 20; // number of orders
var DEF_CALLBACK = 'callback'; // number of orders

// shop url
var FC2_ORDER_FROM_MAIL = 'order@cart.fc2.com';
var SHOP_URL = 'http://nihonmitsubati.cart.fc2.com/';

// product infofmation
var PRODUCT_INFO = {
	'1':{'name': '蜜蝋80g', 'url': 'ca2/1/p-r-s/'},
	'20':{'name': '分蜂誘引剤', 'url': 'ca1/20/p-r-s/'},
	'21':{'name': '分蜂誘引剤【5個セット】', 'url': 'ca1/21/p-r-s/'},
	'28':{'name': '分蜂誘引剤【10個セット】', 'url': 'ca1/28/p-r-s/'},
	'32':{'name': '誘引剤ではじめる！スタートセット', 'url': 'ca1/32/p-r-s/'},
	'34':{'name': '誘引剤ではじめる！スタートセット 3セット', 'url': 'ca1/34/p-r-s/'},
	'15':{'name': 'これならできる！ニホンミツバチの週末養蜂', 'url': 'ca1/15/p-r-s/'},
	'16':{'name': 'スタートセット', 'url': 'ca1/16/p-r-s/'},
	'33':{'name': '重箱式巣箱2段式', 'url': 'ca1/33/p-r-s/'},
	'19':{'name': '巣箱4段セット', 'url':  'ca1/19/p-r-s/'},
	'18':{'name': '新型鉄製台', 'url': 'ca1/18/p-r-s/'},
	'12':{'name': '重箱2つセット', 'url': 'ca2/12/p-r-s/'},
	'13':{'name': '日本蜜蜂のはちみつ 300g×2本', 'url': 'ca1/13/p-r-s/'},
	'3':{'name': '日本蜜蜂(ニホンミツバチ)の蜂蜜の搾りカス 150ｇ　養蜂指南書つき', 'url': '/ca2/3/p-r-s/'},
};

/**
 * Entry point 
 */
function doGet(e) {
	return getJsonpOutPut(DEF_CALLBACK, DEF_MAX_COUNT);
}

function getJsonpOutPut(callback, limit) {
	var json = getJson(limit);
 	var jsonp = callback + '('+ json + ');';
    return ContentService.createTextOutput(jsonp).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/**
 * get order information json. if cache exist, use cache. if not, create json from gmail 
 */
function getJson(limit){
	var cacheService = CacheService.getScriptCache();
	var cache =	cacheService.get(CACHE_KEY);

	// if cache exist, return cache
	if(cache) {
		return cache;

		// get from gmail
	} else {
		var json = getJsonFromGmail(limit);
		cacheService.put(CACHE_KEY, json);
	}
}

function getJsonFromGmail(limit){

	var resultArr = [];
	var searchCondition = 'from:(' + FC2_ORDER_FROM_MAIL + ')';
	var offset = 0;
	var count = 2

	var threads = GmailApp.search(searchCondition, offset, count);

	TL: for (var i = 0; i < threads.length; i++) {
		var tmpThread = threads[i];
		var messages = tmpThread.getMessages();

		// check message in thread order by date descend
		for (var k = messages.length - 1; k >= 0; k--) {

			// if number of orders is over max count, break thread loop
			if(resultArr.length >= limit) {
				break TL;	
			}

			var orderObj = getOrderFromMessage(messages[k])

			// failed to get infromation
			if(orderObj === false) {
				Logger.log('failed to get order information. body:' + messages[k].getBody());
				continue;
			}

			resultArr.push(orderObj);
		}
	}
	return JSON.stringify(resultArr);
}

function getOrderObjFromPCMail(message) {

	var body = message.getBody();
	var ordersHtmlList = body.match(/No.[0-9]{1,}&nbsp; &nbsp; &nbsp; &nbsp; [0-9]{1,}&nbsp; &nbsp;( )*[0-9]{1,},[0-9]{3}円&nbsp; &nbsp;( )*[0-9]{1,},[0-9]{3}円&nbsp; &nbsp; &nbsp; &nbsp;/g);

	// PCメール
	if(ordersHtmlList) {
		var orderObj = {};

		orderObj.date = message.getDate();
		orderObj.products = [];

		for(var i=0; i < ordersHtmlList.length; i++) {
			var res = ordersHtmlList[i].replace(/&nbsp;/g, '').replace(/( ){1,}/g, ' ').replace(/No./g, '').replace(/円/g, '').trim();

			var tmp = res.split(' ');
			var tmpObj = {};
			tmpObj.id = tmp[0];
			tmpObj.count = tmp[1];
			tmpObj.sum = tmp[3];

			var productInfo = PRODUCT_INFO[tmpObj.id];
			tmpObj.name = productInfo.name;
			tmpObj.url = SHOP_URL + productInfo.url;

			orderObj.products.push(tmpObj);
		}
		return orderObj;

		// order email of smartphone order 
	} else {
		return false;
	}
}


function getOrderObjFromMobileMail(message) {

	var orderObj = {};
	orderObj.date = message.getDate();
	orderObj.products = [];

	var body = message.getBody()
	var matchArr = body.match(/商品番号：No.[0-9]{1,}/g);
	var matchArr2 = body.match(/数　量：[0-9]{1,}（個）/g);
	var matchArr3 = body.match(/金　額：[0-9]{1,},[0-9]{3}/g);

	if(matchArr && matchArr2 && matchArr3) {
		return false;
	}

	for(var i=0; i < matchArr.length; i++) {
		var tmpObj = {};
		tmpObj.id = matchArr[0].replace(/商品番号：No./, '');
		tmpObj.count = matchArr2[0].replace(/数　量：/, '');
		tmpObj.count = tmpObj.count.replace(/\（個\）/, '');
		tmpObj.sum= matchArr3[0].replace(/金　額：/, '');

		var productInfo = PRODUCT_INFO[tmpObj.id];
		tmpObj.name = productInfo.name;
		tmpObj.url = productInfo.url;

		orderObj.products.push(tmpObj);
	} 
	return orderObj;
}

function getOrderFromMessage(message){
	var body = message.getBody()
	var resultArr = [];
	var orderObjFromPC = getOrderObjFromPCMail(message)

	if(orderObjFromPC) {
		return orderObjFromPC;
	}

	var oderObjFromMobile = getOrderObjFromMobileMail(message);
	if(oderObjFromMobile){
		return oderObjFromMobile;
	}

	return false;
}

/**
 * clear all cache [debug function]
 */
function clearCache(){
	var cacheService = CacheService.getScriptCache();
	cacheService.removeAll([CACHE_KEY]);
}