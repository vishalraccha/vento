export default function ConnectDriveButton() {
  const connectGoogle = () => {
    window.location.href =
      "https://qkbibprgxcmlgyspthha.supabase.co/functions/v1/google-oauth";
  };

  return (
    <button
      onClick={connectGoogle}
      style={{
        padding: "10px 20px",
        background: "#4285F4",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer"
      }}
    >
      Connect Google Drive
    </button>
  );
}