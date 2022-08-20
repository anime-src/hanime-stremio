
const axios = require("axios");
const execSync = require("child_process");

const default_authority = "hw.hanime.tv";

const headers = {
    'authority': 'search.htv-services.com',
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json;charset=UTF-8'
};

async function search(search_text, tags, order_by, ordering, page) {

    const body = {
        "search_text": search_text,
        "tags": tags || [],
        "tags_mode":"AND",
        "brands": [],
        "blacklist": [],
        "order_by": order_by ||"created_at_unix",
        "ordering": ordering || "asc",
        "page": page || 0
        }

    const result = (await axios.post('https://search.htv-services.com/', body, { headers: headers }))

    return result.status === 200 ? JSON.stringify(result.data) : result.statusText
}

function getHeadersForVideo(authority) {
    return {
        'authority': authority,
        'accept': 'application/json, text/plain, */*',
        'origin': 'https://hanime.tv',
        'if-none-match': 'W/"a5e2787805920a8145ce33ab7c0fd947"'
    };
}

async function getVideo(authority, slug) {
    const author = authority ?? default_authority;
    const url = `https://${author}/api/v8/video?id=${slug}&`
    const result = (await axios.get(url, { headers: getHeadersForVideo(author) }))
    return result.status === 200 ? JSON.stringify(result.data) : result.statusText;
}

async function getVideoMedia(authority, slug) {
    const resp = await getVideo(authority, slug)
    const json = JSON.parse(resp)
    return json.videos_manifest.servers[0].streams;
}

async function downloadVideo(url, path) {
    const filename = path + '/' + Math.random().toString(36).substring(7) + '.mp4'
    execSync(`dl ${url} ${filename}`, {})
    return filename;
}

var hanime =  hanime || {};
hanime.api = hanime.api || {};
hanime.api.query = hanime.api.query || {};
hanime.api.video = hanime.api.video || {};
hanime.api.query.search = search;
hanime.api.video.getVideo = getVideo;
hanime.api.video.getVideoMedia = getVideoMedia;
hanime.api.video.downloadVideo = downloadVideo;

module.exports = { hanime }
