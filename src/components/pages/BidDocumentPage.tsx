'use client';

import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, FileCheck, Download, Search, X, AlertCircle, Check } from 'lucide-react';
import type { BidDocument, Template, VariableValue } from '@/types';
import { seedLotIds } from '@/lib/classification/seed-lot-ids';
import {
  getEffectiveTemplateVariables,
  getMockBidDocuments,
  getMockTemplates,
  setMockBidDocuments,
  softDeleteBidDocument,
} from '@/lib/mockData';
import { appendDataAudit, getMockActor } from '@/lib/dataAudit';
import { SystemDialog } from '@/components/ui/SystemDialog';
import { sortByCreatedAtDesc } from '@/lib/sortByCreatedAtDesc';
import { systemUi } from '@/lib/systemUi';
import { FormSelect } from '@/components/ui/FormSelect';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

// Mock 数据
const mockTemplates: Template[] = [
  {
    id: 'tpl-1',
    name: '服务器设备采购范本 V1.0',
    frameworkId: 'fw-1',
    lotLevelId: seedLotIds.kxx,
    lotLevelName: '储能电站EPC',
    status: 'published',
    createdAt: '2024-01-20',
    updatedAt: '2024-01-25',
    sections: [],
    variables: [
      { id: 'var-1', name: '招标人', key: '{{招标人}}', defaultValue: '' },
      { id: 'var-2', name: '项目名称', key: '{{项目名称}}', defaultValue: '' },
      { id: 'var-3', name: '项目编号', key: '{{项目编号}}', defaultValue: '' },
      { id: 'var-4', name: '预算金额', key: '{{预算金额}}', defaultValue: '' },
      { id: 'var-5', name: '处理器要求', key: '{{处理器要求}}', defaultValue: '' },
      { id: 'var-6', name: '内存要求', key: '{{内存要求}}', defaultValue: '' },
      { id: 'var-7', name: '硬盘要求', key: '{{硬盘要求}}', defaultValue: '' },
      { id: 'var-8', name: '网络要求', key: '{{网络要求}}', defaultValue: '' },
    ],
  },
];

const mockBidDocuments: BidDocument[] = [
  {
    id: 'bid-1',
    name: '2024年度数据中心服务器采购项目',
    templateId: 'tpl-1',
    templateName: '服务器设备采购范本 V1.0',
    projectName: '数据中心服务器采购',
    status: 'completed',
    createdAt: '2024-01-26',
    updatedAt: '2024-01-28',
    variableValues: [
      { variableId: 'var-1', key: '{{招标人}}', name: '招标人', value: '某某市政府采购中心' },
      { variableId: 'var-2', key: '{{项目名称}}', name: '项目名称', value: '2024年度数据中心服务器采购项目' },
      { variableId: 'var-3', key: '{{项目编号}}', name: '项目编号', value: 'ZFCG-2024-001' },
      { variableId: 'var-4', key: '{{预算金额}}', name: '预算金额', value: '500' },
      { variableId: 'var-5', key: '{{处理器要求}}', name: '处理器要求', value: 'Intel Xeon Gold 6248R 或同等性能' },
      { variableId: 'var-6', key: '{{内存要求}}', name: '内存要求', value: '256GB DDR4 ECC' },
      { variableId: 'var-7', key: '{{硬盘要求}}', name: '硬盘要求', value: '4TB SSD + 8TB HDD' },
      { variableId: 'var-8', key: '{{网络要求}}', name: '网络要求', value: '双万兆网卡' },
    ],
    sections: [],
  },
  {
    id: 'bid-2',
    name: '办公区网络设备更新项目',
    templateId: 'tpl-1',
    templateName: '服务器设备采购范本 V1.0',
    projectName: '办公区网络设备更新',
    status: 'draft',
    createdAt: '2024-01-29',
    updatedAt: '2024-01-30',
    variableValues: [],
    sections: [],
  },
];

export default function BidDocumentPage() {
  const [templates] = useState<Template[]>(() => {
    const sharedTemplates = getMockTemplates();
    return sharedTemplates.length > 0 ? sharedTemplates : mockTemplates;
  });
  const [bidDocuments, setBidDocuments] = useState<BidDocument[]>(() => {
    const storedDocs = getMockBidDocuments();
    return storedDocs.length > 0 ? storedDocs : mockBidDocuments;
  });
  const [selectedDoc, setSelectedDoc] = useState<BidDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const updateBidDocuments = (updater: BidDocument[] | ((prev: BidDocument[]) => BidDocument[])) => {
    setBidDocuments((prev) => {
      const next = typeof updater === 'function' ? (updater as (prev: BidDocument[]) => BidDocument[])(prev) : updater;
      setMockBidDocuments(next);
      return next;
    });
  };

  const filteredDocs = useMemo(() => {
    const filtered = bidDocuments.filter(
      (doc) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.projectName.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    return sortByCreatedAtDesc(filtered);
  }, [bidDocuments, searchQuery]);

  const templateForSelectedDoc = useMemo(
    () => (selectedDoc ? templates.find((t) => t.id === selectedDoc.templateId) : undefined),
    [selectedDoc, templates],
  );
  const variablesForEditModal = useMemo(
    () => (templateForSelectedDoc ? getEffectiveTemplateVariables(templateForSelectedDoc) : []),
    [templateForSelectedDoc],
  );

  const openCreateModal = () => {
    setSelectedTemplate('');
    setNewDocName('');
    setNewProjectName('');
    setVariableValues({});
    setShowCreateModal(true);
  };

  const openEditModal = (doc: BidDocument) => {
    setSelectedDoc(doc);
    const template = templates.find(t => t.id === doc.templateId);
    if (template) {
      const values: Record<string, string> = {};
      doc.variableValues.forEach(v => {
        values[v.variableId] = v.value;
      });
      setVariableValues(values);
    }
    setShowEditModal(true);
  };

  const handleCreateDocument = () => {
    if (!selectedTemplate || !newDocName.trim() || !newProjectName.trim()) return;

    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;

    const newDoc: BidDocument = {
      id: `bid-${Date.now()}`,
      name: newDocName,
      templateId: selectedTemplate,
      templateName: template.name,
      projectName: newProjectName,
      status: 'draft',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      variableValues: [],
      sections: [],
    };

    updateBidDocuments((prev) => [...prev, newDoc]);
    appendDataAudit({
      scope: 'bid',
      action: 'create',
      entityId: newDoc.id,
      label: newDoc.name,
      actor: getMockActor(),
    });
    setSelectedDoc(newDoc);
    setShowCreateModal(false);
  };

  const handleSaveVariables = () => {
    if (!selectedDoc) return;

    const template = templates.find(t => t.id === selectedDoc.templateId);
    if (!template) return;

    const vars = getEffectiveTemplateVariables(template);
    const values: VariableValue[] = vars.map((v) => ({
      variableId: v.id,
      key: v.key,
      name: v.name,
      value: variableValues[v.id] || '',
    }));

    updateBidDocuments(prev => prev.map(doc =>
      doc.id === selectedDoc.id
        ? { ...doc, variableValues: values, updatedAt: new Date().toISOString().split('T')[0] }
        : doc
    ));

    setSelectedDoc(prev => prev ? { ...prev, variableValues: values } : null);
    appendDataAudit({
      scope: 'bid',
      action: 'update',
      entityId: selectedDoc.id,
      label: selectedDoc.name,
      detail: '保存变量',
      actor: getMockActor(),
    });
    setShowEditModal(false);
  };

  const handleFinalizeDocument = (id: string) => {
    const doc = bidDocuments.find((d) => d.id === id);
    updateBidDocuments(prev => prev.map(d =>
      d.id === id ? { ...d, status: 'completed' as const } : d
    ));
    appendDataAudit({
      scope: 'bid',
      action: 'update',
      entityId: id,
      label: doc?.name,
      detail: '已定稿',
      actor: getMockActor(),
    });
  };

  const handleDeleteDocument = (id: string) => {
    setDeleteDocId(id);
  };

  const confirmDeleteDocument = () => {
    if (!deleteDocId) return;
    const id = deleteDocId;
    softDeleteBidDocument(id, getMockActor());
    setBidDocuments((prev) => prev.filter((doc) => doc.id !== id));
    if (selectedDoc?.id === id) {
      setSelectedDoc(null);
    }
    setDeleteDocId(null);
  };

  const getStatusBadge = (status: BidDocument['status']) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-700',
      completed: 'bg-green-50 text-green-700',
      archived: 'bg-amber-50 text-amber-700',
    };
    const labels = {
      draft: '草稿',
      completed: '已定稿',
      archived: '已归档',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getCompletionRate = (doc: BidDocument) => {
    const template = templates.find(t => t.id === doc.templateId);
    const vars = template ? getEffectiveTemplateVariables(template) : [];
    if (!template || vars.length === 0) return 100;

    const filledCount = doc.variableValues.filter(v => v.value.trim() !== '').length;
    return Math.round((filledCount / vars.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* 页面说明与操作（标题由 MainLayout 顶栏展示） */}
      <div className="flex items-center justify-between">
        <p className={systemUi.pageDesc}>基于范本生成招标文件，填写变量信息</p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          新建招标文件
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 左侧：招标文件列表 */}
        <div className="col-span-4 space-y-4">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索招标文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 文件列表 */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm divide-y divide-slate-200 max-h-[calc(100vh-280px)] overflow-y-auto">
            {filteredDocs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                <FileCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>暂无招标文件</p>
                <p className="text-xs mt-1">点击“新建招标文件”创建</p>
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const completionRate = getCompletionRate(doc);
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedDoc?.id === doc.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-medium text-slate-900 flex-1">{doc.name}</h4>
                      {getStatusBadge(doc.status)}
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{doc.projectName}</p>

                    {/* 完成度进度条 */}
                    {doc.status === 'draft' && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>变量填写进度</span>
                          <span>{completionRate}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              completionRate === 100 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{doc.templateName}</span>
                      <span>{doc.updatedAt}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 右侧：招标文件详情 */}
        <div className="col-span-8">
          {selectedDoc ? (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
              {/* 文件头部 */}
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{selectedDoc.name}</h3>
                      {getStatusBadge(selectedDoc.status)}
                    </div>
                    <p className="text-sm text-slate-600">{selectedDoc.projectName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                      title="下载"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(selectedDoc.id)}
                      className="p-2 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">使用范本：</span>
                    <span className="text-slate-900 font-medium">{selectedDoc.templateName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">创建时间：</span>
                    <span className="text-slate-900">{selectedDoc.createdAt}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">更新时间：</span>
                    <span className="text-slate-900">{selectedDoc.updatedAt}</span>
                  </div>
                </div>
              </div>

              {/* 变量填写区 */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-slate-900">变量信息</h4>
                  {selectedDoc.status === 'draft' && (
                    <button
                      onClick={() => openEditModal(selectedDoc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      编辑变量
                    </button>
                  )}
                </div>

                {selectedDoc.variableValues.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    <p className="text-sm text-amber-800 mb-3">尚未填写变量信息</p>
                    <button
                      onClick={() => openEditModal(selectedDoc)}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                    >
                      立即填写
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDoc.variableValues.map((v) => (
                      <div key={v.variableId} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-slate-700">{v.name}</span>
                            <code className="text-xs px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600 font-mono">
                              {v.key}
                            </code>
                          </div>
                          <p className="text-sm text-slate-900">
                            {v.value || <span className="text-slate-400 italic">未填写</span>}
                          </p>
                        </div>
                        {v.value && (
                          <Check className="w-4 h-4 text-green-600 mt-1" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedDoc.status === 'draft' && getCompletionRate(selectedDoc) === 100 && (
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <button
                      onClick={() => handleFinalizeDocument(selectedDoc.id)}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      确认定稿
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm h-full flex items-center justify-center">
              <div className="text-center text-slate-400">
                <FileCheck className="w-16 h-16 mx-auto mb-4" />
                <p className="text-sm">请从左侧选择一个招标文件查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 新建招标文件弹窗 */}
      {showCreateModal && (
        <ModalOverlay>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">新建招标文件</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">选择范本 *</label>
                <FormSelect
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                >
                  <option value="">请选择范本</option>
                  {sortByCreatedAtDesc(templates.filter(t => t.status === 'published')).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </FormSelect>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">招标文件名称 *</label>
                <input
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="例如：2024年度数据中心服务器采购项目"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">项目名称 *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="例如：数据中心服务器采购"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>提示：</strong>创建后需要填写范本中的变量信息，完成后即可生成正式的招标文件。
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateDocument}
                disabled={!selectedTemplate || !newDocName.trim() || !newProjectName.trim()}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 编辑变量弹窗 */}
      {showEditModal && selectedDoc && (
        <ModalOverlay>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">填写变量信息</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {variablesForEditModal.map((variable) => (
                <div key={variable.id}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {variable.name}
                    <code className="ml-2 text-xs px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono">
                      {variable.key}
                    </code>
                  </label>
                  <input
                    type="text"
                    value={variableValues[variable.id] || ''}
                    onChange={(e) => setVariableValues({ ...variableValues, [variable.id]: e.target.value })}
                    placeholder={
                      variable.defaultValue?.trim()
                        ? variable.defaultValue.trim()
                        : `请输入${variable.name}`
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveVariables}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <SystemDialog
        open={deleteDocId !== null}
        title="确认删除"
        message="确定要删除此招标文件吗？"
        tone="danger"
        variant="confirm"
        onClose={() => setDeleteDocId(null)}
        onConfirm={confirmDeleteDocument}
      />
    </div>
  );
}
