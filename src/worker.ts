import { getProbs } from "./getProbs";

onmessage = (event) => {
	const output = getProbs(event.data.chances, event.data.numToPick);
	console.log("Worker: Message received from main script", event.data);
	postMessage(output);
};
