import Command from './Command'

class Undo extends Command {
  getCommandState (params) {
    const editorSession = params.editorSession
    return {
      disabled: !editorSession.canUndo(),
      active: false
    }
  }

  execute (params) {
    const editorSession = params.editorSession
    if (editorSession.canUndo()) {
      editorSession.undo()
    }
    return true
  }
}

export default Undo
