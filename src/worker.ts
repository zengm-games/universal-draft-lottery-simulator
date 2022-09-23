import { getProbs } from "./getProbs";

onmessage = (event) => {
	postMessage({
		...getProbs(event.data.chances, event.data.numToPick),
		requestCount: event.data.requestCount,
	});
};
