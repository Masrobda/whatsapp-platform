// components/ui/Pagination.tsx (version flèches uniquement)
'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className={`
          flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-700
          ${currentPage === 1 
            ? 'opacity-50 cursor-not-allowed bg-gray-50' 
            : 'hover:bg-gray-100 bg-white'}
        `}
      >
        ←
      </button>

      <span className="text-sm font-medium px-2 text-gray-700">
        {currentPage} / {totalPages}
      </span>

      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className={`
          flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-700
          ${currentPage === totalPages 
            ? 'opacity-50 cursor-not-allowed bg-gray-50' 
            : 'hover:bg-gray-100 bg-white'}
        `}
      >
        →
      </button>
    </div>
  );
}
