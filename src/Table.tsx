import { type Dispatch, type StateUpdater, useState } from "preact/hooks";
import { checkNamesAreAllDefault, getDefaultNames, type Team } from "./App";

const ordinal = (x: number) => {
	let suffix;

	if (x % 100 >= 11 && x % 100 <= 13) {
		suffix = "th";
	} else if (x % 10 === 1) {
		suffix = "st";
	} else if (x % 10 === 2) {
		suffix = "nd";
	} else if (x % 10 === 3) {
		suffix = "rd";
	} else {
		suffix = "th";
	}

	return x.toString() + suffix;
};

const formatPercent = (num: number | undefined) => {
	if (num === undefined) {
		return num;
	}

	if (num === 1) {
		return "100%";
	}

	return `${(num * 100).toFixed(1)}%`;
};

type TableProps = {
	loadingProbs: boolean;
	lotteryResults: number[] | undefined;
	probs: number[][];
	setLotteryResults: Dispatch<StateUpdater<number[] | undefined>>;
	setPresetKey: Dispatch<StateUpdater<string>>;
	setTeams: Dispatch<StateUpdater<Team[]>>;
	teams: Team[];
};

const Row = ({
	chance,
	i,
	lotteryResults,
	loadingProbs,
	probs,
	setLotteryResults,
	setPresetKey,
	setTeams,
	teams,
}: {
	chance: number;
	i: number;
} & TableProps) => {
	const [highlight, setHighlight] = useState(false);

	const nameId = `name-${i}`;
	const chancesId = `chances-${i}`;

	return (
		<tr
			className={`border-b ${
				highlight
					? "odd:bg-yellow-200 even:bg-yellow-100 hover:bg-[#f6edaa]"
					: "odd:bg-gray-100 hover:bg-gray-200"
			}`}
			onClick={(event: any) => {
				const ignoredElements = ["BUTTON", "INPUT"];
				if (ignoredElements.includes(event.target.nodeName)) {
					return;
				}
				setHighlight((value) => !value);
			}}
		>
			<td className="py-0 w-0">
				<button
					className="text-red-600 text-xl"
					type="button"
					onClick={() => {
						setLotteryResults(undefined);
						setPresetKey("custom");

						const newTeams = teams.filter((t, j) => j !== i);

						const namesAreAllDefault = checkNamesAreAllDefault(teams);
						if (namesAreAllDefault) {
							const newNames = getDefaultNames(newTeams.length);
							setTeams(
								newTeams.map((t, j) => {
									return {
										chances: t.chances,
										name: newNames[j]!,
									};
								}),
							);
						} else {
							setTeams(newTeams);
						}
						setHighlight(false);
					}}
					title="Remove team"
				>
					✕
				</button>
			</td>
			<td className="py-0">
				<label className="sr-only" htmlFor={nameId}>
					Name of team #{i + 1}
				</label>
				<input
					id={nameId}
					className="form-control py-1 px-2 text-sm w-[100px]"
					type="text"
					value={teams[i]!.name}
					onChange={(event) => {
						const newName = (event.target as any).value;
						setTeams(
							teams.map((t, j) =>
								j === i
									? {
											chances: t.chances,
											name: newName,
										}
									: t,
							),
						);
					}}
				/>
			</td>
			<td className="py-0 w-0">
				<label className="sr-only" htmlFor={chancesId}>
					Lottery chances for team #{i + 1}
				</label>
				<input
					id={chancesId}
					className="form-control py-1 px-2 text-sm"
					type="text"
					value={chance}
					onChange={(event) => {
						const number = parseFloat((event.target as any).value);
						if (!Number.isNaN(number)) {
							setLotteryResults(undefined);
							setPresetKey("custom");
							setTeams(
								teams.map((t, j) =>
									j === i
										? {
												chances: number,
												name: t.name,
											}
										: t,
								),
							);
						}
					}}
				/>
			</td>
			{teams.map((t, j) => {
				const pct = formatPercent(probs[i]?.[j]);
				return (
					<td
						className={`${
							lotteryResults && lotteryResults[j] === i ? "bg-green-200" : ""
						}${loadingProbs ? " text-gray-500" : ""}`}
					>
						{pct ?? "\u00A0"}
					</td>
				);
			})}
		</tr>
	);
};

export const Table = (props: TableProps) => {
	return (
		<table
			className="table-auto"
			style={{
				width: "unset",
			}}
		>
			<thead className="text-center">
				<tr className="border-b-2 border-gray-500">
					<th />
					<th>Team Name</th>
					<th>Chances</th>
					{props.teams.map((t, i) => (
						<th key={i}>{ordinal(i + 1)}</th>
					))}
				</tr>
			</thead>
			<tbody className="text-end">
				{props.teams.map((t, i) => {
					return <Row key={i} i={i} chance={t.chances} {...props} />;
				})}
			</tbody>
		</table>
	);
};
