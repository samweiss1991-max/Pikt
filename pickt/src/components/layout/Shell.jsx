import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Shell({ children, pageTitle, actions }) {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Topbar title={pageTitle} actions={actions} />
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 32px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
