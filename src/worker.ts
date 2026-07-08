import "./polyfills.ts";
import { getProbs } from "./getProbs";

onmessage = (event) => {
	postMessage({
		...getProbs(event.data.chances, event.data.numToPick, event.data.nba2027Restrictions),
		requestCount: event.data.requestCount,
	});
};
