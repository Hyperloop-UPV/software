interface LogsContentTitleProps {
  title: string;
}

const LogsContentTitle = ({ title }: LogsContentTitleProps) => {
  return (
    <div className="mb-6 flex items-center gap-8 px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border text-4xl shadow-sm">
        📦
      </div>
      <h2 className="max-w-full truncate text-4xl font-bold">{title}</h2>
    </div>
  );
};

export default LogsContentTitle;
