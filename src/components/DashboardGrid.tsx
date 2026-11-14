import type { ReactNode } from "react";
import { ReactGridLayout, WidthProvider } from "react-grid-layout/legacy";
import type { Layout } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";

const Grid = WidthProvider(ReactGridLayout);

const COLS = 12;
const ROW_HEIGHT = 40;

interface Props {
  layout: Layout;
  onLayoutChange: (layout: Layout) => void;
  equity: ReactNode;
  exposure: ReactNode;
  funding: ReactNode;
  positions: ReactNode;
}

export function DashboardGrid({
  layout,
  onLayoutChange,
  equity,
  exposure,
  funding,
  positions,
}: Props) {
  return (
    <Grid
      className="layout"
      layout={layout}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
      margin={[12, 12]}
      containerPadding={[0, 0]}
      draggableHandle=".drag-handle"
      resizeHandles={["se"]}
      compactType="vertical"
      onLayoutChange={onLayoutChange}
    >
      <div key="equity" className="h-full w-full">
        {equity}
      </div>
      <div key="exposure" className="h-full w-full">
        {exposure}
      </div>
      <div key="funding" className="h-full w-full">
        {funding}
      </div>
      <div key="positions" className="h-full w-full">
        {positions}
      </div>
    </Grid>
  );
}
