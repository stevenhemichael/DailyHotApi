const Router = require("koa-router");
const wereadRouter = new Router();
const axios = require("axios");
const { get, set, del } = require("../utils/cacheData");

// 缓存键名
const cacheKey = "wereadData";

// 调用时间
let updateTime = new Date().toISOString();

// 调用路径
const url =
  "https://weread.qq.com/web/bookListInCategory/rising?maxIndex=0&rank=1";

// 数据处理
const getData = (data) => {
  if (!data) return [];
  return data.map((v) => {
    const book = v.bookInfo;
    return {
      id: book.topic_id,
      title: v.topic_name,
      desc: v.topic_desc,
      pic: v.topic_pic,
      hot: v.discuss_num,
      url: v.topic_url,
      mobileUrl: v.topic_url,
    };
  });
};

// 微信读书
wereadRouter.get("/weread", async (ctx) => {
  console.log("获取微信读书");
  try {
    // 从缓存中获取数据
    let data = await get(cacheKey);
    const from = data ? "cache" : "server";
    if (!data) {
      // 如果缓存中不存在数据
      console.log("从服务端重新获取微信读书");
      // 从服务器拉取数据
      const response = await axios.get(url);
      data = getData(response.data.books);
      updateTime = new Date().toISOString();
      if (!data) {
        ctx.body = {
          code: 500,
          title: "微信读书",
          subtitle: "飙升榜",
          message: "获取失败",
        };
        return false;
      }
      // 将数据写入缓存
      await set(cacheKey, data);
    }
    ctx.body = {
      code: 200,
      message: "获取成功",
      title: "微信读书",
      subtitle: "飙升榜",
      from,
      total: data.length,
      updateTime,
      data,
    };
  } catch (error) {
    console.error(error);
    ctx.body = {
      code: 500,
      message: "获取失败",
    };
  }
});

// 微信读书 - 获取最新数据
wereadRouter.get("/weread/new", async (ctx) => {
  console.log("获取微信读书 - 最新数据");
  try {
    // 从服务器拉取最新数据
    const response = await axios.get(url);
    const newData = getData(response.data);
    updateTime = new Date().toISOString();
    console.log("从服务端重新获取微信读书");

    // 返回最新数据
    ctx.body = {
      code: 200,
      message: "获取成功",
      title: "微信读书",
      subtitle: "飙升榜",
      total: newData.length,
      updateTime,
      data: newData,
    };

    // 删除旧数据
    await del(cacheKey);
    // 将最新数据写入缓存
    await set(cacheKey, newData);
  } catch (error) {
    // 如果拉取最新数据失败，尝试从缓存中获取数据
    console.error(error);
    const cachedData = await get(cacheKey);
    if (cachedData) {
      ctx.body = {
        code: 200,
        message: "获取成功",
        title: "微信读书",
        subtitle: "飙升榜",
        total: cachedData.length,
        updateTime,
        data: cachedData,
      };
    } else {
      // 如果缓存中也没有数据，则返回错误信息
      ctx.body = {
        code: 500,
        title: "微信读书",
        subtitle: "飙升榜",
        message: "获取失败",
      };
    }
  }
});

module.exports = wereadRouter;
