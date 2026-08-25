'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { FiDownload, FiX, FiCalendar } from 'react-icons/fi';

const PERIODS = [
  { label: '24 heures', days: 1, icon: '🕐' },
  { label: '7 jours', days: 7, icon: '📅' },
  { label: '15 jours', days: 15, icon: '📆' },
  { label: '30 jours', days: 30, icon: '📊' },
];

export default function ExportPeriodModal({ isOpen, onClose, onExport, isExporting }) {
  const [selectedDays, setSelectedDays] = useState(7);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport(selectedDays);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-dark">Exporter les conversations</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-gray-600 mb-4">Choisissez la période à exporter :</p>
          
          <div className="space-y-2">
            {PERIODS.map((period) => (
              <label
                key={period.days}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedDays === period.days
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="period"
                  value={period.days}
                  checked={selectedDays === period.days}
                  onChange={() => setSelectedDays(period.days)}
                  className="mr-3 text-primary"
                />
                <span className="text-lg mr-2">{period.icon}</span>
                <span className="flex-1 font-medium">{period.label}</span>
                <span className="text-sm text-gray-500">
                  {period.days === 1 ? 'Dernières 24h' : `Derniers ${period.days} jours`}
                </span>
              </label>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleExport} isLoading={isExporting}>
            <FiDownload className="mr-2" />
            Exporter
          </Button>
        </div>
      </div>
    </div>
  );
}
