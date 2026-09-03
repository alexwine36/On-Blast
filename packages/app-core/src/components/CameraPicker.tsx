interface CameraPickerProps {
	devices: MediaDeviceInfo[];
	value?: string;
	onChange: (deviceId: string | undefined) => void;
	disabled?: boolean;
}

export function CameraPicker({ devices, value, onChange, disabled }: CameraPickerProps) {
	if (devices.length === 0) return null;

	return (
		<label className="picker">
			<span className="picker__label">Camera</span>
			<select
				className="picker__select"
				value={value ?? ""}
				disabled={disabled}
				onChange={(e) => onChange(e.target.value || undefined)}
			>
				<option value="">Default</option>
				{devices.map((device, i) => (
					<option key={device.deviceId} value={device.deviceId}>
						{device.label || `Camera ${i + 1}`}
					</option>
				))}
			</select>
		</label>
	);
}
