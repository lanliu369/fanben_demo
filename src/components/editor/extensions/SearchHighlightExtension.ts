import { Extension } from '@tiptap/core';
import type { RawCommands } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      nextSearchResult: () => ReturnType;
      previousSearchResult: () => ReturnType;
      replaceNext: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
      getSearchResults: () => ReturnType;
    };
  }
}

interface SearchState {
  searchTerm: string;
  results: Array<{ from: number; to: number }>;
  currentIndex: number;
}

interface CommandContext {
  state: EditorState;
  dispatch?: (tr: Transaction) => void;
}

interface ReplaceCommandContext extends CommandContext {
  tr: Transaction;
}

interface ReplaceAllCommandContext extends ReplaceCommandContext {
  editor: {
    commands: {
      setSearchTerm: (term: string) => void;
    };
  };
}

const searchPluginKey = new PluginKey<SearchState>('searchHighlight');

export const SearchHighlightExtension = Extension.create({
  name: 'searchHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init: () => ({ searchTerm: '', results: [], currentIndex: -1 }),
          apply: (tr, state) => {
            const meta = tr.getMeta(searchPluginKey);
            if (meta) {
              return meta;
            }
            return state;
          },
        },
        props: {
          decorations: (state) => {
            const { searchTerm, results, currentIndex } = searchPluginKey.getState(state) || {};
            if (!searchTerm || !results || results.length === 0) {
              return DecorationSet.empty;
            }

            const decorations = results.map((result, index) => {
              const className = index === currentIndex ? 'search-highlight-current' : 'search-highlight';
              return Decoration.inline(result.from, result.to, {
                class: className,
                nodeName: 'mark',
              });
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setSearchTerm: (searchTerm: string) => ({ state, dispatch }: CommandContext) => {
        if (!searchTerm) {
          if (dispatch) {
            dispatch(state.tr.setMeta(searchPluginKey, { searchTerm: '', results: [], currentIndex: -1 }));
          }
          return true;
        }

        const results: Array<{ from: number; to: number }> = [];
        const term = searchTerm.toLowerCase();

        state.doc.descendants((node: ProseMirrorNode, nodePos: number) => {
          if (node.isText && node.text) {
            const nodeText = node.text.toLowerCase();
            let index = 0;
            while ((index = nodeText.indexOf(term, index)) !== -1) {
              results.push({
                from: nodePos + index,
                to: nodePos + index + term.length,
              });
              index += term.length;
            }
          }
        });

        if (dispatch) {
          dispatch(state.tr.setMeta(searchPluginKey, { searchTerm, results, currentIndex: results.length > 0 ? 0 : -1 }));
        }
        return true;
      },

      nextSearchResult: () => ({ state, dispatch }: CommandContext) => {
        const pluginState = searchPluginKey.getState(state);
        if (!pluginState || pluginState.results.length === 0) return false;

        const nextIndex = (pluginState.currentIndex + 1) % pluginState.results.length;
        if (dispatch) {
          dispatch(state.tr.setMeta(searchPluginKey, { ...pluginState, currentIndex: nextIndex }));
        }
        return true;
      },

      previousSearchResult: () => ({ state, dispatch }: CommandContext) => {
        const pluginState = searchPluginKey.getState(state);
        if (!pluginState || pluginState.results.length === 0) return false;

        const prevIndex = pluginState.currentIndex === 0 ? pluginState.results.length - 1 : pluginState.currentIndex - 1;
        if (dispatch) {
          dispatch(state.tr.setMeta(searchPluginKey, { ...pluginState, currentIndex: prevIndex }));
        }
        return true;
      },

      replaceNext: (replacement: string) => ({ state, dispatch, tr }: ReplaceCommandContext) => {
        const pluginState = searchPluginKey.getState(state);
        if (!pluginState || pluginState.results.length === 0 || pluginState.currentIndex === -1) return false;

        const current = pluginState.results[pluginState.currentIndex];
        if (dispatch) {
          tr.insertText(replacement, current.from, current.to);
          dispatch(tr);
        }
        return true;
      },

      replaceAll: (replacement: string) => ({ state, dispatch, tr, editor }: ReplaceAllCommandContext) => {
        const pluginState = searchPluginKey.getState(state);
        if (!pluginState || pluginState.results.length === 0) return false;

        const sortedResults = [...pluginState.results].sort((a, b) => b.from - a.from);

        sortedResults.forEach((result) => {
          tr.insertText(replacement, result.from, result.to);
        });

        if (dispatch) {
          dispatch(tr);
          setTimeout(() => {
            editor.commands.setSearchTerm('');
          }, 0);
        }
        return true;
      },

      getSearchResults: () => ({ state }: CommandContext) => {
        const pluginState = searchPluginKey.getState(state);
        return pluginState || { searchTerm: '', results: [], currentIndex: -1 };
      },
    } as unknown as Partial<RawCommands>;
  },
});
