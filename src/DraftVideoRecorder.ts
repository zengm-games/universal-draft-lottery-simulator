import { ordinal, teamGradientColors } from "./draftBoardUtil";

const WIDTH = 720;
const MAX_HEIGHT = 1280;
const FPS = 30;
const HEADER_HEIGHT = 80;
const PADDING = 16;
const ROW_GAP = 6;

// These match the CSS animations on the live draft board
const REVEAL_ANIMATION_MS = 600;
const FIRST_GLOW_MS = 1800;

const PICK_BADGE_GRADIENTS: Record<number, readonly [string, string]> = {
	1: ["#fde68a", "#d6a514"],
	2: ["#f1f5f9", "#94a3b8"],
	3: ["#e8ae80", "#b26a3d"],
};

const MIME_TYPES = ["video/webm;codecs=vp9", "video/webm", "video/mp4"];

const pickMimeType = () =>
	MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));

export const videoRecordingSupported = () =>
	typeof MediaRecorder !== "undefined" &&
	typeof HTMLCanvasElement !== "undefined" &&
	"captureStream" in HTMLCanvasElement.prototype &&
	pickMimeType() !== undefined;

export const createDraftVideoRecorder = (
	lotteryResults: number[],
	names: string[],
): DraftVideoRecorder | undefined => {
	if (!videoRecordingSupported()) {
		return undefined;
	}

	try {
		return new DraftVideoRecorder(lotteryResults, names);
	} catch {
		return undefined;
	}
};

const roundedRectPath = (
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) => {
	ctx.beginPath();
	if (typeof ctx.roundRect === "function") {
		ctx.roundRect(x, y, width, height, radius);
	} else {
		ctx.rect(x, y, width, height);
	}
};

// Records a video of the draft lottery reveal by mirroring the animation
// onto a hidden canvas captured with MediaRecorder, so the result can be
// shared with people who didn't watch it live. The DraftBoard component
// reports reveals via setNumRevealed as they happen on screen.
export class DraftVideoRecorder {
	readonly extension: string;

	private lotteryResults: number[];
	private names: string[];
	private rowHeight: number;

	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private recorder: MediaRecorder;
	private chunks: Blob[] = [];
	private rafId = 0;
	private done = false;

	constructor(lotteryResults: number[], names: string[]) {
		this.lotteryResults = lotteryResults;
		this.names = names;

		const numTeams = lotteryResults.length;
		this.rowHeight = Math.max(
			30,
			Math.min(
				64,
				Math.floor((MAX_HEIGHT - HEADER_HEIGHT - 2 * PADDING) / numTeams) -
					ROW_GAP,
			),
		);
		const height =
			HEADER_HEIGHT +
			2 * PADDING +
			numTeams * (this.rowHeight + ROW_GAP) -
			ROW_GAP;

		this.canvas = document.createElement("canvas");
		this.canvas.width = WIDTH;
		// Some encoders require even dimensions
		this.canvas.height = 2 * Math.ceil(height / 2);
		this.ctx = this.canvas.getContext("2d")!;

		const mimeType = pickMimeType()!;
		this.extension = mimeType.includes("mp4") ? "mp4" : "webm";

		this.recorder = new MediaRecorder(this.canvas.captureStream(FPS), {
			mimeType,
		});
		this.recorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				this.chunks.push(event.data);
			}
		};
		this.recorder.start();

		this.draw();
	}

	// Timestamps of when each pick was revealed on the live board, used to
	// animate the same reveals on the canvas
	private revealTimes: number[] = [];

	setNumRevealed(numRevealed: number) {
		while (this.revealTimes.length < numRevealed) {
			this.revealTimes.push(performance.now());
		}
	}

	// Finish recording and return the video, or undefined if recording failed
	stop() {
		return new Promise<Blob | undefined>((resolve) => {
			if (this.done) {
				resolve(undefined);
				return;
			}
			this.done = true;
			cancelAnimationFrame(this.rafId);

			this.recorder.onstop = () => {
				this.cleanup();
				resolve(
					this.chunks.length > 0
						? new Blob(this.chunks, { type: this.recorder.mimeType })
						: undefined,
				);
			};

			try {
				this.recorder.stop();
			} catch {
				this.cleanup();
				resolve(undefined);
			}
		});
	}

	cancel() {
		if (this.done) {
			return;
		}
		this.done = true;
		cancelAnimationFrame(this.rafId);

		try {
			this.recorder.stop();
		} catch {}
		this.cleanup();
	}

	private cleanup() {
		for (const track of this.recorder.stream.getTracks()) {
			track.stop();
		}
	}

	private draw = () => {
		this.renderFrame(performance.now());
		this.rafId = requestAnimationFrame(this.draw);
	};

	private renderFrame(now: number) {
		const { canvas, ctx, rowHeight } = this;
		const numTeams = this.lotteryResults.length;

		ctx.fillStyle = "#0f172a";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = "#fff";
		ctx.font = "bold 40px Kanit, sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("DRAFT LOTTERY RESULTS", canvas.width / 2, HEADER_HEIGHT / 2);

		const badgeWidth = Math.round(rowHeight * 1.4);
		const slotX = PADDING + badgeWidth + ROW_GAP;
		const slotWidth = canvas.width - PADDING - slotX;

		for (let i = 0; i < numTeams; i++) {
			const teamIndex = this.lotteryResults[i];
			const pick = i + 1;
			const y = HEADER_HEIGHT + PADDING + i * (rowHeight + ROW_GAP);

			// Pick number badge
			const badgeGradient = PICK_BADGE_GRADIENTS[pick];
			if (badgeGradient) {
				const gradient = ctx.createLinearGradient(0, y, 0, y + rowHeight);
				gradient.addColorStop(0, badgeGradient[0]);
				gradient.addColorStop(1, badgeGradient[1]);
				ctx.fillStyle = gradient;
			} else {
				ctx.fillStyle = "#e2e8f0";
			}
			roundedRectPath(ctx, PADDING, y, badgeWidth, rowHeight, 4);
			ctx.fill();

			ctx.fillStyle = "#1e293b";
			ctx.font = `bold ${Math.round(rowHeight * 0.35)}px sans-serif`;
			ctx.textAlign = "center";
			ctx.fillText(ordinal(pick), PADDING + badgeWidth / 2, y + rowHeight / 2);

			// Empty slot
			ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
			roundedRectPath(ctx, slotX, y, slotWidth, rowHeight, 4);
			ctx.fill();

			// Picks reveal from the last up to the 1st, so row i's reveal is
			// the (numTeams - 1 - i)th one
			const revealTime = this.revealTimes[numTeams - 1 - i];
			if (revealTime === undefined) {
				continue;
			}

			const progress = Math.min(1, (now - revealTime) / REVEAL_ANIMATION_MS);

			ctx.save();
			ctx.globalAlpha = progress;

			// Squash vertically from the bottom edge, like the CSS flip-in
			const scale = Math.max(Math.sin((progress * Math.PI) / 2), 0.001);
			ctx.translate(0, y + rowHeight);
			ctx.scale(1, scale);
			ctx.translate(0, -(y + rowHeight));

			if (pick === 1) {
				const glowAge = now - revealTime;
				if (glowAge < FIRST_GLOW_MS) {
					ctx.shadowColor = "rgba(253, 230, 138, 0.9)";
					ctx.shadowBlur = 24 * Math.sin((Math.PI * glowAge) / FIRST_GLOW_MS);
				}
			}

			const [from, to] = teamGradientColors(teamIndex, numTeams);
			const gradient = ctx.createLinearGradient(0, y, 0, y + rowHeight);
			gradient.addColorStop(0, from);
			gradient.addColorStop(1, to);
			ctx.fillStyle = gradient;
			roundedRectPath(ctx, slotX, y, slotWidth, rowHeight, 4);
			ctx.fill();
			ctx.shadowBlur = 0;

			// Clip so long names don't spill out of the row
			ctx.clip();
			ctx.fillStyle = "#fff";
			ctx.font = `bold ${Math.round(rowHeight * 0.45)}px sans-serif`;
			ctx.textAlign = "left";
			ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
			ctx.shadowBlur = 5;
			ctx.fillText(
				this.names[teamIndex] ?? `Team ${teamIndex + 1}`,
				slotX + 12,
				y + rowHeight / 2,
			);

			ctx.restore();
		}
	}
}
