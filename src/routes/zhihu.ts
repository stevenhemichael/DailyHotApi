import type { RouterData } from "../types.js";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";
import { config } from "../config.js";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "zhihu",
    title: "知乎",
    type: "热榜",
    link: "https://www.zhihu.com/hot",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface ZhihuTarget {
  id: string;
  title: string;
  excerpt: string;
  created: number;
  url: string;
}

interface ZhihuChild {
  thumbnail: string;
}

interface ZhihuItem {
  target: ZhihuTarget;
  children: ZhihuChild[];
  detail_text: string;
}

interface ZhihuResponse {
  data: ZhihuItem[];
}

const getList = async (noCache: boolean) => {
  // api.zhihu.com 这个端点从大多数 IP 免 cookie 即可访问；
  // 仅当配置了 ZHIHU_COOKIE 时才带上登录态，作为被风控时的备选。
  const url = `https://api.zhihu.com/topstory/hot-lists/total?limit=50`;
  try {
    const result = await get<ZhihuResponse>({
      url,
      noCache,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Referer: "https://www.zhihu.com/hot",
        Accept: "application/json, text/plain, */*",
        ...(config.ZHIHU_COOKIE && { Cookie: config.ZHIHU_COOKIE }),
      },
    });

    const list = Array.isArray(result.data?.data) ? result.data.data : [];
    if (!list.length) {
      return { ...result, data: [] as ZhihuItem[] };
    }

    return {
      ...result,
      data: list.map((v) => {
        const data = v.target;
        const questionId = data.url.split("/").pop();
        return {
          id: data.id,
          title: data.title,
          desc: data.excerpt,
          cover: v.children?.[0]?.thumbnail || "",
          timestamp: getTime(data.created),
          hot: parseFloat((v.detail_text || "0").split(" ")[0]) * 10000,
          url: `https://www.zhihu.com/question/${questionId}`,
          mobileUrl: `https://www.zhihu.com/question/${questionId}`,
        };
      }),
    };
  } catch {
    // 被风控 / 网络失败时返回空列表，避免前端直接报错崩溃
    return {
      fromCache: false,
      updateTime: new Date().toISOString(),
      data: [] as ZhihuItem[],
    };
  }
};
