interface Props {
  name: string;
}

export function ToolLoading({ name }: Props) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
        <p className="mt-4 text-gray-600">正在加载 {name}...</p>
      </div>
    </div>
  );
}
